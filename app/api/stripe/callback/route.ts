// app/api/stripe/webhook/route.ts

import { getBundleById } from '@/lib/api/bundle';
import { cancelSubscription, createSubscription, enableSubscription, PaymentCompleted, PaymentCompleteForSubscription, paymentFailed } from '@/lib/api/payment/stripehelper';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inizializza il client di Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Gestione del webhook
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature') as string;

  console.log('Received webhook event:', sig);
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;  // La tua chiave segreta del webhook
  const chunks = [];
  const reader = req.body?.getReader();
  if (!reader) throw new Error('No request body');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);

  let event;

  try {
    // Verifica la firma della richiesta con il secret del webhook
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    // Gestisci l'evento in base al tipo
    // case 'invoice.payment_succeeded':
    //   const invoice = event.data.object as Stripe.Invoice;
    //   const customerId = invoice.customer;

    //   console.log(`Payment succeeded for invoice ${invoice.id}`);
    //   // Aggiungi logica per aggiornare il database o inviare un'email di conferma

    //   return NextResponse.json({ status: 'ok' }, { status: 200 });
    //   break;
    switch (event.type) {
      case 'setup_intent.succeeded':
        const setupIntent = event.data.object as Stripe.SetupIntent;

        const paymentMethodId = setupIntent.payment_method;  // Payment method ID configurato

        // Recupera i metadata dal SetupIntent
        interface SetupIntentMetadata {
          userId: string;
          bundleId: number;
          creatorId: string;
        }
        const { userId, bundleId, creatorId } = setupIntent.metadata as unknown as SetupIntentMetadata;

        // Verifica che customer esista e sia una stringa valida
        if (!setupIntent.customer || typeof setupIntent.customer !== 'string') {
          throw new Error('Invalid customer ID');
        }

        const bundle = await getBundleById(bundleId);  // Recupera il bundle dal database

        if (!bundle || 'error' in bundle) {
          throw new Error('Bundle not found');
        }

        // Verifica che paymentMethodId sia definito e sia una stringa
        if (!paymentMethodId || typeof paymentMethodId !== 'string') {
          throw new Error('Payment method not found or invalid');
        }

        // Ora puoi creare la sottoscrizione con il metodo di pagamento configurato
        createSubscription({
          stripeCustomerId: setupIntent.customer,
          paymentMethodId,
          buyer_id: userId,
          bundleId: bundleId,
          priceId: bundle.stripe_price_id,  // Sostituisci con l'ID del prezzo specifico
        }).then((response) => {
          console.log('Subscription created:', response);
        }).catch((error) => {
          console.error('Error creating subscription:', error);
        })
        // Rispondi al webhook con il successo
        console.log(`Subscription created for customer: ${setupIntent.customer}`);
        return NextResponse.json({ status: 'ok' }, { status: 200 });

      case 'payment_intent.succeeded':
        const data = event.data.object as Stripe.PaymentIntent;
        const res = await PaymentCompleted(data)

        if (!res || res.error) {
          return NextResponse.json({ error: 'Error processing payment' }, { status: 500 });
        }
        break;

      case 'customer.subscription.created':
        const subscription = event.data.object as Stripe.Subscription;
        const sbures = await enableSubscription(subscription);

        if (!sbures || sbures.error) {
          return NextResponse.json({ error: 'Error enabling subscription' }, { status: 500 });
        }
        break;

      case 'customer.subscription.updated':
        const canelSubres = await cancelSubscription(event.data.object as Stripe.Subscription)

        if (!canelSubres) {
          return NextResponse.json({ error: 'Error cancelling subscription' }, { status: 500 });
        }
        break;

      case 'customer.subscription.deleted':
        const canelSubresDel = await cancelSubscription(event.data.object as Stripe.Subscription)

        if (!canelSubresDel) {
          return NextResponse.json({ error: 'Error cancelling subscription' }, { status: 500 });
        }
        break;
        break;

      case 'payment_intent.payment_failed':

        const paymentFailedRes = await paymentFailed(event.data.object as Stripe.PaymentIntent)

        if ("error" in paymentFailed) {
          return NextResponse.json({ error: 'Error handle payment failed' }, { status: 500 });
        }

        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Error processing event:', error);
    return NextResponse.json({ error: 'Error processing webhook event' }, { status: 500 });
  }
}
