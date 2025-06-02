'use client';

import { useEffect, useState } from 'react';
import { useStripe, useElements, Elements, PaymentElement } from '@stripe/react-stripe-js';
import { Appearance, loadStripe, StripeCardElement, StripeElementsOptions } from '@stripe/stripe-js';
import { createCheckoutSession } from '@/lib/api/payment/stripehelper';
import { Button } from '../ui/button';
import { useTheme } from 'next-themes';
import LoadingAnimation from '../ui/loading-animation';

interface Props {
    bundleId: number;
    subscription: boolean;
}

function CheckoutForm({ clientSecret, subscription }: { clientSecret: string, subscription: boolean }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setLoading(true);
        console.log(subscription)
        if(subscription){
            const { error: submitError } = await elements.submit();
            if (submitError) {
                setError(submitError.message || 'Error submitting payment');
                setLoading(false);
                return;
            }
            const result = await stripe.confirmSetup({
                elements,
                clientSecret,
                confirmParams: {
                    return_url: `${window.location.origin}/subscriptions`,
                }
            });
            if (result.error) {
                setError(result.error.message || 'Error in setup');
                setLoading(false);
            }

        }else{
            const result = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/success`, // puoi cambiare con la tua pagina di successo
                },
            });
    
            if (result.error) {
                setError(result.error.message || 'Errore nel pagamento');
                setLoading(false);
            }
        }

    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            {error && <p className="text-red-500">{error}</p>}
            <Button type="submit" disabled={loading || !stripe || !elements} className='w-full'>
                {loading ? 'Validating' : 'Pay now'}
            </Button>
        </form>
    );
}

export default function EmbeddedStripeForm({ bundleId, subscription }: Props) {
    const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);

    console.log(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY)
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    const { setTheme, theme } = useTheme()
    
    const appearance : Appearance = {
        theme: theme === 'dark' ? 'night' : 'stripe',
    };
    
    const [options, setOptions] = useState<StripeElementsOptions>({
        clientSecret: clientSecret ?? undefined,
        appearance,
    });

    useEffect(() => {
        (async () => {
            try {
                const result = await createCheckoutSession(bundleId); // deve creare un PaymentIntent o SetupIntent con `automatic_payment_methods: { enabled: true }`
                setClientSecret(result.client_secret);
                setOptions({
                    clientSecret: result.client_secret ?? undefined,
                    appearance,
                });
            } catch (err) {
                console.error('Errore creazione intent:', err);
            }
        })();
    }, [bundleId]);

    if (!clientSecret) return <LoadingAnimation size='xl' />;




    return (
        <Elements stripe={stripePromise} options={options}>
            <CheckoutForm clientSecret={clientSecret} subscription={subscription}  />
        </Elements>
    );
}
