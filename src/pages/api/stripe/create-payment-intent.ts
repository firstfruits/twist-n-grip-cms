import type { APIRoute } from "astro";
import Stripe from "stripe";

// Initialize Stripe. Use your STRIPE_SECRET_KEY from .env
const stripe = new Stripe(
  import.meta.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    // Extract optional intentId
    const { product, intentId } = body;

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

    let paymentIntent;

    const unitPrice = parseFloat(product.price);
    const qty = product.quantity || 1;
    const totalAmount = ((unitPrice * qty * 100) / 100).toFixed(2); // dollar string

    const metadata = {
      productName: product.title || "Twist-n-Grip",
      quantity: String(qty),
      unitPrice: `$${unitPrice.toFixed(2)}`,
      totalAmount: `$${totalAmount}`,
    };

    if (intentId) {
      // Update existing PaymentIntent if it exists
      paymentIntent = await stripe.paymentIntents.update(intentId, {
        amount,
        metadata,
      });
    } else {
      // Create a PaymentIntent
      paymentIntent = await stripe.paymentIntents.create({
        amount,
        // currency: "nzd",
        currency: "usd",
        payment_method_types: ["card"],
        metadata,
      });
    }

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
