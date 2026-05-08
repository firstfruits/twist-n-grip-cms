import type { APIRoute } from "astro";
import Stripe from "stripe";

// Initialize Stripe. Use your STRIPE_SECRET_KEY from .env
const stripe = new Stripe(
  import.meta.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { product } = body;

    // Validate the incoming product data
    if (!product || !product.price) {
      return new Response(
        JSON.stringify({ error: "Missing required product details" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Convert price to cents (Stripe expects amounts in cents)
    const amount =
      Math.round(parseFloat(product.price) * 100) * (product.quantity || 1);

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        productName: product.title || "Twist-n-Grip",
      },
    });

    // Return the required clientSecret to the frontend to finalize payment
    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        id: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Stripe Payment Intent Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
