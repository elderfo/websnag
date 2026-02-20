-- Add cancel_at_period_end to track pending cancellations from Stripe
ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
