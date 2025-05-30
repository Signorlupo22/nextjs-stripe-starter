"use server"

import { createClient } from "@/lib/supabase/server";
import { GetCurrentUser } from "../auth";
import { getBundleById } from "../bundle";

import Stripe from 'stripe';
import { Bundle, Payments, Subscriptions, User } from "@/lib/supabase/type";


export async function createCheckoutSession(bundleId: number) {
    "use server"
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    });

    try {
        const bundle = await getBundleById(bundleId);

        if ("error" in bundle) {
            throw new Error('Bundle not found' + bundle.error);
        }
        const currentUser = await GetCurrentUser();

        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        if (!bundle) {
            throw new Error('Bundle not found');
        }

        const userId = currentUser.id;

        const stripeCustomerId = await ensureStripeCustomer(userId);


        console.log("Stripe customer ID:", stripeCustomerId);

        if (bundle.type === 'recurring') {
            // Se il bundle ha un price su Stripe, usa quello, altrimenti creane uno nuovo.
            const priceId = bundle.stripe_price_id;

            if (!priceId) {
                throw new Error("Price ID for recurring subscription not found");
            }

            // Crea una sessione di checkout su Stripe
            const setupIntent = await stripe.setupIntents.create({
                customer: stripeCustomerId,
                metadata: {
                    userId: userId,
                    bundleId: bundle.id.toString(),
                    creatorId: bundle.user_id,
                    type: 'recurring',
                },
                payment_method_types: ['card'], // Assicurati che il tipo di pagamento sia carta
            });

            console.log("Checkout session created:", setupIntent.client_secret);

            return { client_secret: setupIntent.client_secret };

        } else {
            // Se il bundle non è di tipo "recurring", puoi gestire il pagamento una tantum
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(bundle.price * 100),
                currency: bundle.currency,
                customer: stripeCustomerId,
                metadata: {
                    bundle_id: bundle.id.toString(),
                    creator_id: bundle.user_id,
                    buyer_id: currentUser.id,
                    type: "one-time"
                },
                automatic_payment_methods: { enabled: true },
            });

            console.log("PaymentIntent created:", paymentIntent.id);
            return { client_secret: paymentIntent.client_secret };
        }

    } catch (error: any) {
        console.error("Error creating checkout session:", error);
        throw new Error(`Error creating session: ${error.message}`);
    }
}


export const createStripeCustomer = async (userId: string, email: string, firstName: string, lastName: string): Promise<string> => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

    const supabase = await createClient();

    try {
        // Verifica se l'utente ha già un customer associato
        const { data: userData } = await supabase.from('User').select('stripe_customer_id').eq('id', userId).single();

        if (userData?.stripe_customer_id) {
            console.log(`Stripe customer already exists: ${userData.stripe_customer_id}`);
            return userData.stripe_customer_id;  // Se esiste già, restituisce l'ID del customer
        }

        // Se il customer non esiste, crea un nuovo customer su Stripe
        const customer = await stripe.customers.create({
            email,
            name: `${firstName} ${lastName}`,
        });

        console.log('Stripe customer created:', customer.id);

        // Salva il customer ID nella tabella `users` di Supabase
        await supabase
            .from('User')
            .update({ stripe_customer_id: customer.id })
            .eq('id', userId);

        return customer.id;  // Restituisce l'ID del customer appena creato

    } catch (error) {
        console.error('Error creating or retrieving Stripe customer:', error);
        throw new Error('Error creating or retrieving Stripe customer');
    }
};

export const ensureStripeCustomer = async (userId: string): Promise<string> => {

    const supabase = await createClient();

    try {
        // Verifica se l'utente ha già un customer Stripe
        const { data: userData, error } = await supabase
            .from('User')
            .select('id, email, first_name, last_name, stripe_customer_id')
            .eq('id', userId)
            .single();


        // Se esiste già un customer, restituisci l'ID
        if (userData?.stripe_customer_id) {
            console.log(`Stripe customer already exists: ${userData.stripe_customer_id}`);
            return userData.stripe_customer_id;
        }

        if (!userData) {
            throw new Error('User not found in Supabase');
        }

        // Se il customer non esiste, crea un nuovo customer su Stripe
        const customer = await createStripeCustomer(userId, userData.email, userData.first_name, userData.last_name);
        // Restituisci l'ID del customer appena creato
        return customer;
    } catch (error) {
        console.error('Error ensuring or creating Stripe customer:', error);
        throw new Error('Error ensuring or creating Stripe customer');
    }
};


export async function createSubscription({
    stripeCustomerId,
    paymentMethodId,
    buyer_id,
    priceId,
    bundleId,
}: {
    stripeCustomerId: string;
    paymentMethodId: string;
    priceId: string;
    buyer_id: string;
    bundleId: number;
}) {
    "use server"

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);


    if (!paymentMethodId || !priceId || !stripeCustomerId) {
        return { error: 'Missing required parameters' };
    }

    try {
        const bundle = await getBundleById(bundleId);

        if (!bundle || 'error' in bundle) {
            throw new Error('Bundle not found');
        }

        // Crea la sottoscrizione usando il paymentMethodId
        const subscription = await stripe.subscriptions.create({
            customer: stripeCustomerId,
            items: [{
                price: priceId,
            }],
            metadata: {
                userId: buyer_id,
                bundleId: bundleId.toString(),
                creatorId: bundle.user_id,
            },
            default_payment_method: paymentMethodId, // Usa il metodo di pagamento
        });

        const now = new Date().toISOString();


        const supabase = await createClient();

        // Create subscription record
        console.log("Creating Subscriptions")
        const { data: info, error: subscriptionError } = await supabase.from('Subscriptions').insert({
            user_id: buyer_id,
            bundle_id: bundle.id,
            payment_status: 'pending',
            price: bundle.price,
            frequency: 'recurring',
            adyen_payment_reference: subscription.id,
            start_date: now,
            end_date: null,
            created_at: now,
            updated_at: now
        }).select("id")

        console.log("Sub info ", info);


        if (!info) {
            return { error: "error creatng Subscriptions" }
        }

        if (subscriptionError) {
            console.error('Error creating subscription record:', subscriptionError);
            throw new Error('Error creating subscription record');
        }

        const { data: payment, error: paymentError } = await supabase
            .from('Payments')
            .insert({
                amount: bundle.price,
                user_id: buyer_id,
                payment_type: "recurring",
                adyen_transaction_id: "",
                creator_id: bundle.user_id,
                status: 'pending',
                payment_method: 'card',
                payment_date: now,
                created_at: now,
                updated_at: now,
                subscription_id: info[0].id

            })
            .select()
            .single();

        if (paymentError) {
            console.log("error", paymentError.message);

            return { error: paymentError.message }
        }

        console.log(payment)


        // Rispondi con i dettagli della sottoscrizione
        return subscription;
    } catch (error) {
        console.error('Error creating subscription:', error);
        return { error: 'Error creating subscription' };
    }
}

export async function cancelSubscription(info: Stripe.Subscription) {
    "use server"

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

    const supabase = await createClient();

    const subscriptionId = info.id;

    if (!subscriptionId) {
        throw new Error('Subscription ID not found');
    }

    if (info.cancel_at) {
        console.log("Subscription will be canceled at:", new Date(info.cancel_at * 1000).toISOString());
        console.log("Subscription ID:", subscriptionId);
        const endDate = new Date(info.cancel_at * 1000).toISOString();
        const updatedAt = new Date().toISOString();
        console.log("End date:", endDate);
        console.log("Updated at:", updatedAt);
        const { data, error } = await supabase.from('Subscriptions').update({
            payment_status: 'cancelled',
            updated_at: updatedAt,
            end_date: endDate
        }).eq('adyen_payment_reference', subscriptionId)
            .eq('payment_status', 'paid')
            .is('end_date', null)
            .select("*")

        if (error) {
            console.error('Error updating subscription:', error);
            return { error: 'Error updating subscription' };
        }

        console.log("Subscription updated:", data);


        return { success: true };
    }


}

export async function PaymentCompleteForSubscription(userId: string, adyen_payment_reference: string): Promise<string | null> {
    const supabase = await createClient();

    try {
        const { error } = await supabase.from('Subscriptions')
            .update({
                adyen_payment_reference: adyen_payment_reference,
                payment_status: "active",
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .is('end_date', null);

        if (error) {
            console.error('Error updating subscription:', error);
            return null;
        }

        return adyen_payment_reference;
    } catch (error) {
        console.error('Error in PaymentCompleteForSubscription:', error);
        return null;
    }
}



export async function PaymentCompleted(paymentIntent: Stripe.PaymentIntent) {
    "use server"

    const supabase = await createClient();

    const now = new Date().toISOString();

    const amount = paymentIntent.amount_received / 100;
    const type = paymentIntent.capture_method === 'automatic' ? 'recurring' : 'one-time';

    const customer_Id = paymentIntent.customer as string;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // console.log(paymentIntent.invoice)

    // const subscription = await stripe.invoices.retrieve(paymentIntent.invoice as string);

    const buyer_id = paymentIntent.metadata?.userId;


    const { data: user, error: userError } = await supabase
        .from('User')
        .select('id')
        .eq('stripe_customer_id', customer_Id)
        .single();

    if (userError || !user) {
        console.error('User not found:', userError);
        return { error: 'User not found' };
    }


    if (type == "recurring") {

        const { data: payment, error: paymentError } = await supabase
            .from('Payments')
            .update({
                status: 'completed',
                adyen_transaction_id: paymentIntent.id,
                payment_type: type,
                payment_date: now,
                updated_at: now,
            })
            .eq("user_id", user.id)
            .eq("status", "pending")
            .eq("amount", amount)
            .select()
            .single();

        if (paymentError) {
            console.error('Payment insert error:', paymentError);
            return { error: 'Payment insert error' };
        }
    }

    if (type === 'one-time') {
        const bundleId = parseInt(paymentIntent.metadata?.bundle_id || '0');

        const bundle = await getBundleById(Number(bundleId));

        if(!bundle || "error" in bundle){
            return { error: "Bundle id not found"}
        }

        const {data: info, error: subscriptionError } = await supabase.from('Subscriptions').insert({
            user_id: user.id,
            bundle_id: bundleId,
            payment_status: 'paid',
            price: amount,
            frequency: 'one-time',
            adyen_payment_reference: paymentIntent.id,
            start_date: now,
            end_date: null,
            created_at: now,
            updated_at: now
        }).select("id")

        if (subscriptionError) {
            console.error('Subscription insert error:', subscriptionError);
            return { error: 'Subscription insert error' };
        }
        

        const { data: payment, error: paymentError } = await supabase
        .from('Payments')
        .insert({
            amount: bundle.price,
            adyen_payment_reference: paymentIntent.id,
            user_id: user.id,
            payment_type: "recurring",
            adyen_transaction_id: "",
            creator_id: bundle.user_id,
            status: 'completed',
            payment_method: 'card',
            payment_date: now,
            created_at: now,
            updated_at: now,
            subscription_id: info[0].id

        })
        .select()
        .single();

    if (paymentError) {
        console.log("error", paymentError.message);

        return { error: paymentError.message }
    }
    }

    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

}

export async function paymentFailed(paymentIntent: Stripe.PaymentIntent) {
    "use server"

    const supabase = await createClient();

    const now = new Date().toISOString();

    const amount = paymentIntent.amount_received / 100;
    const type = paymentIntent.capture_method === 'automatic' ? 'recurring' : 'one-time';

    const customer_Id = paymentIntent.customer as string;


    const { data: user, error: userError } = await supabase
        .from('User')
        .select('id')
        .eq('stripe_customer_id', customer_Id)
        .single();

    if (userError || !user) {
        console.error('User not found:', userError);
        return { error: 'User not found' };
    }

    const { data: payment, error: paymentError } = await supabase
        .from('Payments')
        .insert({
            user_id: user.id,
            amount,
            status: 'failed',
            payment_method: 'card',
            adyen_transaction_id: paymentIntent.id,
            payment_type: type,
            payment_date: now,
            created_at: now,
            updated_at: now,
        })
        .select()
        .single();

    if (paymentError) {
        console.error('Payment insert error:', paymentError);
        return { error: 'Payment insert error' };
    }

    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

}


export async function enableSubscription(subscription: Stripe.Subscription) {

    const supabase = await createClient();

    const bundleId = parseInt(subscription.metadata?.bundleId || '0');

    console.log("Bundle ID:", subscription.metadata);

    const { data: user } = await supabase
        .from('User')
        .select('id')
        .eq('stripe_customer_id', subscription.customer as string)
        .single<User>();

    if (!user) {
        console.error('User not found:');
        return { error: 'User not found' };
    }

    const { error: subscriptionError } = await supabase
        .from('Subscriptions')
        .update({
            payment_status: 'paid',
        }).eq('user_id', user.id)
        .eq('bundle_id', bundleId)
        .eq('payment_status', 'pending')

    if (subscriptionError) {
        console.error('Subscription insert error:', subscriptionError);
        return { error: 'Subscription insert error' };
    }

    return { success: true };
}



export async function cancelSubscriptionUser(sub: Subscriptions) {

    "use server"
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    const subscription_id = sub.adyen_payment_reference;

    try {
        const subscription = await stripe.subscriptions.update(subscription_id, {
            cancel_at_period_end: true
        });

        return { success: true };
    } catch (error) {
        console.error('Error canceling subscription:', error);
        return { error: 'Failed to cancel subscription' };
    }

}
