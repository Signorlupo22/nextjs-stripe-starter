'use client';

import EmbeddedStripeForm from '@/components/paymentUi/stripeCheckout';

export default function SubscriptionPage() {
    // Example bundle ID - replace with your actual bundle ID
    const bundleId = 1;

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <p className='text-center text-sm text-gray-500'>you have to add a bundle on the database to use this feature</p>
                <h1 className="text-2xl font-bold mb-6 text-center">Subscribe to Premium Plan</h1>
                <div className="space-y-4">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold">Premium Features</h2>
                        <ul className="mt-4 space-y-2 text-left">
                            <li>✓ Unlimited access</li>
                            <li>✓ Priority support</li>
                            <li>✓ Advanced features</li>
                            <li>✓ Monthly updates</li>
                        </ul>
                    </div>
                    <div className="border-t pt-6">
                        <EmbeddedStripeForm bundleId={bundleId} subscription={true} />
                    </div>
                </div>
            </div>
        </div>
    );
} 