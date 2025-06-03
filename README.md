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

## Docker Setup

The project includes Docker configuration for easy deployment and scaling. The setup consists of multiple services orchestrated through Docker Compose.

### Docker Services

1. **TeachFlow Application**
   - Next.js application running in production mode
   - Configured with 3 replicas for high availability
   - Exposed on port 3000 internally

2. **Reverse Proxy (Traefik)**
   - Handles SSL termination and routing
   - Manages automatic SSL certificate generation
   - Exposes ports:
     - 80 (HTTP)
     - 443 (HTTPS)
     - 8088 (Traefik dashboard)
     - 5433 (PostgreSQL)
     - 8001 (API)

3. **Watchtower**
   - Automatically updates containers when new images are available
   - Runs with 3 replicas
   - Checks for updates every 30 seconds

### Building and Running

1. Build the Docker image:
```bash
docker build --platform linux/amd64 -t singorlupo/teachflow:release .
```

2. Push the image to Docker Hub:
```bash
docker push singorlupo/teachflow:release
```

3. Start the services:
```bash
docker-compose up -d
```

### Environment Variables for Docker

The following environment variables are required in your `.env` file:

```env
ANON_KEY=your_supabase_anon_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLIC_KEY=your_stripe_public_key
JWTSECRETKEY=your_jwt_secret
JWT_SECRET_SALT=your_jwt_salt
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
