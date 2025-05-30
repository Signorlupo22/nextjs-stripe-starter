"use server"
import { FormState } from "@/components/submitButton";
import { createClient } from "@/lib/supabase/server";
import { GetCurrentUser, GetUserByName } from "../auth";
import { Bundle, Subscriptions } from "@/lib/supabase/type";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { cancelSubscriptionUser } from "../payment/stripehelper";



export async function createBundle(
    prevState: FormState, formData: FormData
) {
    "use server"

    console.log(formData);

    // title: string,
    // description: string,
    // price: number,
    // image: string,
    // courseId: string[],
    const title = formData.get('title')?.toString() || "";
    const description = formData.get('description')?.toString() || "";
    const price = formData.get('price');
    const currency = formData.get('currency')?.toString() || "EUR";

    const type = formData.get('type')?.toString() || "recurring";

    if (title == "" || description == "" || price == "" || currency == "") {
        if (title == "") {
            return { error: "Title is empty" };
        }
        if (description == "") {
            return { error: "Description is empty" };
        }
        if (price == "") {
            return { error: "Price is empty" };
        }
        if (currency == "") {
            return { error: "Currency is empty" };
        }
    }

    const supabase = await createClient();

    const currentUser = await GetCurrentUser();

    if (!currentUser) {
        return { error: "User not authenticated" };
    }

    if (!currentUser.is_teacher) {
        return { error: "You are not a teacher" };
    }

    const userId = currentUser.id;

    const { data, error } = await supabase.from("Bundle").insert({
        name: title,
        description: description,
        price: Number(price),
        currency: currency,
        user_id: userId,
        type: type,
    }).select("*").single<Bundle>();

    if (error) {
        console.log(error);
        return { error: error.message };
    }

    console.log(data);

    if (!data) {
        return { error: "Bundle not created" };
    }

    if (type === "recurring") {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

        try {
            // Crea un Price per Stripe (Ricorrente)
            const priceData = await stripe.prices.create({
                unit_amount: Math.round(Number(price) * 100), // Prezzo in centesimi
                currency: currency,
                recurring: { interval: 'month' }, // Abbonamento mensile (può essere modificato)
                product_data: {
                    name: title,
                    unit_label: "Bundle",
                },
            });

            // Associa il Price ID di Stripe al bundle creato nel DB
            const { data: updatedBundle, error: updateError } = await supabase
                .from("Bundle")
                .update({ stripe_price_id: priceData.id })
                .eq("id", data.id);

            if (updateError) {
                console.log(updateError);
                return { error: updateError.message };
            }

            console.log("Price ID associato a Stripe:", priceData.id);
            return { message: "Bundle created with recurring payment" };

        } catch (stripeError: any) {
            console.log(stripeError);
            return { error: `Stripe error: ${stripeError.message}` };
        }
    }

    console.log(data);


    return {
        message: "Bundle created",
    }


}


export async function updateBundle(prevState: FormState, formData: FormData) {
    const id = formData.get('id')?.toString() || "";
    const title = formData.get('title')?.toString() || "";
    const description = formData.get('description')?.toString() || "";
    const price = formData.get('price');
    const currency = formData.get('currency')?.toString() || "EUR";

    console.log(formData);

    if (title == "" || description == "" || price == "" || currency == "") {
        if (title == "") {
            return { error: "Title is empty" };
        }
        if (description == "") {
            return { error: "Description is empty" };
        }
        if (price == "") {
            return { error: "Price is empty" };
        }
        if (currency == "") {
            return { error: "Currency is empty" };
        }
    }

    const supabase = await createClient();

    const currentUser = await GetCurrentUser();

    if (!currentUser) {
        return { error: "User not authenticated" };
    }

    if (!currentUser.is_teacher) {
        console.log("You are not a teacher")
        return { error: "You are not a teacher" };
    }

    const userId = currentUser.id;

    const { data: existingBundle, error: fetchError } = await supabase
        .from("Bundle")
        .select("id, type, stripe_price_id")
        .eq("id", id)
        .eq("user_id", userId)
        .single<Bundle>();

    if (fetchError || !existingBundle) {
        console.log(fetchError);
        return { error: "Bundle not found or unauthorized" };
    }

      // Se il tipo è "recurring", aggiorna anche il prezzo su Stripe
      if (existingBundle.type === "recurring") {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

        try {
            // Create a new price since Stripe doesn't allow updating amounts
            const newPrice = await stripe.prices.create({
                unit_amount: Math.round(Number(price) * 100),
                currency: currency,
                product_data: {
                    name: title,
                    unit_label: "Bundle",
                },
                recurring: { interval: 'month' }
            });

            console.log("New price created:", newPrice.id);
            // Aggiorna il bundle nel DB con i nuovi dati
            const { data, error } = await supabase
                .from("Bundle")
                .update({
                    name: title,
                    description: description,
                    price: Number(price),
                    currency: currency,
                    type: existingBundle.type,
                    stripe_price_id: newPrice.id, // Aggiorna l'ID del prezzo Stripe
                })
                .eq("id", id)
                .eq("user_id", userId);

            if (error) {
                console.log(error);
                return { error: error.message };
            }

            revalidatePath("/subscriptions");

            console.log(data);

            return { message: "Bundle updated with new price on Stripe" };

        } catch (stripeError: any) {
            console.log(stripeError);
            return { error: `Stripe error: ${stripeError.message}` };
        }
    } else {
        // Se non è ricorrente, non c'è bisogno di aggiornare Stripe, quindi aggiorniamo solo il DB
        const { data, error } = await supabase
            .from("Bundle")
            .update({
                name: title,
                description: description,
                price: Number(price),
                currency: currency,
                type: existingBundle.type,
            })
            .eq("id", id)
            .eq("user_id", userId);

        if (error) {
            console.log(error);
            return { error: error.message };
        }

        revalidatePath("/subscriptions");

        console.log(data);

        return { message: "Bundle updated" };
    }
}



export async function getAllBundleFromUserId(username: string): Promise<Bundle[] | { error: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase.from("Bundle").select("*").eq("user_id", username);

    if (error) {
        return { error: error.message };
    }

    return data;
}


export async function getBundleById(id: number): Promise<Bundle | { error: string }> {
    const supabase = await createClient();

    console.log(id);

    const { data, error } = await supabase
        .from("Bundle")
        .select(`
            *,
            BundleCourse (
                course_id,
                Course!inner (
                    *
                )
            )
        `)
        .eq("id", id)
        .eq("BundleCourse.Course.public", true)
        .single();

    if (error) {
        console.log(error);
        return { error: error.message };
    }

    return data;
}




export async function GetBundleByCourseId(course_id: number): Promise<Bundle[] | { error: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("Bundle")
        .select(`
            *,
            BundleCourse!inner (
                course_id,
                Course(*)
            )
        `)
        .eq("BundleCourse.course_id", course_id);

    if (error) {
        return { error: error.message };
    }

    return data;
}


export async function getPaymentDetailsBySubsciption(subscription_id: number): Promise<Subscriptions | { error: string }> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("Subscriptions")
        .select(`
            *,
            Bundle (
                id,
                name,
                description,
                price,
                name
                currency
            )
        `)
        .eq("id", subscription_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<Subscriptions>();

    if (error) {
        return { error: error.message };
    }

    if (!data) {
        return { error: "No payment found" };
    }


    return data;
}



export async function cancelSubscription(subscription_id: string): Promise<{ message: string } | { error: string }> {
    const supabase = await createClient();

    const currentUser = await GetCurrentUser();

    if (!currentUser) {
        return { error: "User not authenticated" };
    }

    const userId = currentUser.id;

    const { data: subscription, error: subscriptionError } = await supabase
        .from("Subscriptions")
        .select("*")
        .eq("id", subscription_id)
        .eq("user_id", userId)
        .single<Subscriptions>();

    if (subscriptionError) {
        console.log(subscriptionError);
        return { error: subscriptionError.message };
    }

    const res = await cancelSubscriptionUser(subscription)
    if(res.error){
        return {error: "error cancel subscription"}
    }

    console.log(res);
    revalidatePath("/subscriptions");

    return {
        message: "Subscription cancelled",
    }
}