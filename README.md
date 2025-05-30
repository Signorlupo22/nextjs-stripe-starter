# Next.js Stripe & Supabase Boilerplate

A modern Next.js boilerplate that integrates Stripe payments and Supabase for handling subscriptions, one-time payments, and user management. This project provides a complete solution for implementing payment processing in your Next.js applications.

## Features

- 🔐 **Authentication** - Built-in user authentication with Supabase
- 💳 **Payment Processing** - Seamless integration with Stripe for both one-time and recurring payments
- 📦 **Bundle Management** - Create and manage different types of payment bundles (subscription plan)
- 🔄 **Subscription Handling** - Full support for recurring subscriptions with automatic renewal
- 🎯 **Webhook Integration** - Robust webhook handling for Stripe events
- 🛡️ **Type Safety** - Built with TypeScript for better development experience

## Tech Stack

- **Framework**: Next.js 14
- **Database**: Supabase
- **Payment Processing**: Stripe
- **Language**: TypeScript
- **Authentication**: Supabase Auth

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A Stripe account with API keys
- A Supabase project set up
- Basic understanding of Next.js and TypeScript

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Database Schema

The project uses the following main tables in Supabase:

### User
- `id`: UUID (Primary Key)
- `email`: String
- `first_name`: String
- `last_name`: String
- `stripe_customer_id`: String

### Bundle
- `id`: Integer (Primary Key)
- `user_id`: UUID (Foreign Key to User)
- `price`: Decimal
- `currency`: String
- `type`: String ('recurring' or 'one-time')
- `stripe_price_id`: String

### Subscriptions
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key to User)
- `bundle_id`: Integer (Foreign Key to Bundle)
- `payment_status`: String
- `price`: Decimal
- `frequency`: String
- `adyen_payment_reference`: String
- `start_date`: Timestamp
- `end_date`: Timestamp

### Payments
- `id`: UUID (Primary Key)
- `user_id`: UUID (Foreign Key to User)
- `amount`: Decimal
- `payment_type`: String
- `status`: String
- `payment_method`: String
- `adyen_transaction_id`: String
- `creator_id`: UUID
- `subscription_id`: UUID (Foreign Key to Subscriptions)

## Getting Started

1. Clone the repository:
```bash
git clone [repository-url]
cd [project-name]
```

2. Install dependencies:
```bash
npm install
```

3. Set up your environment variables as described above

4. Run the development server:
```bash
npm run dev
```

## Key Features Implementation

### Creating a Checkout Session

```typescript
const checkoutSession = await createCheckoutSession(bundleId);
```

### Handling Subscriptions

```typescript
// Create a subscription
const subscription = await createSubscription({
  stripeCustomerId,
  paymentMethodId,
  buyer_id,
  priceId,
  bundleId
});

// Cancel a subscription
const result = await cancelSubscriptionUser(subscription);
```

### Webhook Handling

The project includes a comprehensive webhook handler for Stripe events:
- Payment success/failure
- Subscription creation/updates/deletion
- Setup intent completion

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [Stripe](https://stripe.com/)
- [Supabase](https://supabase.com/)
