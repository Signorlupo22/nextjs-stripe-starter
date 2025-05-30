export interface User {
    id: string; // uuid
    email: string;
    display_name: string;
    first_name: string;
    last_name: string;
    description: string;
    avatar_url: string;
    is_teacher: boolean;
    created_at: string; // timestamp without time zone
    stripe_customer_id: string | null; // ID del cliente Stripe associato all'utente
    social: { name: string; url: string }[];

    // Relazioni
    subscriptions: Subscriptions[];
}


export interface Payments {
    id: number;
    user_id: string;
    creator_id : string;
    amount: number;
    status: 'completed' | 'pending' | 'failed';
    payment_method: 'card';
    stripe_transaction_id: string;
    payment_type: 'one-time' | 'recurring';
    payment_date: string;
    subscription_id: number;
    created_at: string;
    updated_at: string;
    merchant_reference: string;
    payout: boolean,
    // Relazioni
    user: User;
}


export interface Subscriptions {
    id: string;
    user_id: string;
    course_id?: string | null;
    bundle_id?: string | null;
    payment_status: 'paid' | 'pending' | 'failed' | 'cancelled';
    amount: number;
    frequency: 'recurring' | 'one-time';
    adyen_payment_reference: string;
    start_date: string;
    end_date: string;
    created_at: string;
    updated_at: string;
    merchant_reference: string;

    // Relazioni
    Bundle?: Bundle | null;
}


export interface Bundle {
    id: number;
    name: string;
    description: string;
    price: number;
    created_at: string;  // Timestamp (ISO string)
    updated_at: string;  // Timestamp (ISO string)
    currency: string;  // Valuta del prezzo del bundle
    user_id: string;  // ID dell'utente che ha creato il bundle
    type: 'one_time' | 'recurring';  // Tipo di bundle (una tantum o ricorrente)
    stripe_price_id: string;  // ID del prezzo associato al bundle su Stripe

    // Relazioni
    subscriptions: Subscriptions[];  // Gli abbonamenti associati al bundle
}
