import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export interface IWebhook extends Document {
    url: string;
    events: string[];
    secret: string;
    userId: mongoose.Types.ObjectId;
    isActive: boolean;
    lastTriggered: Date | null;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const webhookSchema = new Schema<IWebhook>({
    url: { type: String, required: true },
    events: {
        type: [String],
        required: true,
        validate: {
            validator: (v: string[]) => v.length > 0,
            message: "At least one event is required"
        }
    },
    secret: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
    lastTriggered: { type: Date, default: null },
    failureCount: { type: Number, default: 0 }
}, { timestamps: true });

// Index for efficient lookups
webhookSchema.index({ events: 1, isActive: 1 });
webhookSchema.index({ userId: 1 });

export const Webhook = mongoose.model<IWebhook>("Webhook", webhookSchema);

/**
 * Trigger webhooks for a specific event
 * @param event The event name (e.g., "anime.created")
 * @param payload The data to send to webhook endpoints
 */
export async function triggerWebhooks(event: string, payload: any): Promise<void> {
    try {
        const webhooks = await Webhook.find({
            events: event,
            isActive: true,
            failureCount: { $lt: 10 } // Stop trying after 10 consecutive failures
        });

        if (webhooks.length === 0) return;

        const timestamp = Date.now();

        const promises = webhooks.map(async (webhook: any) => {
            try {
                // Create signature
                const body = JSON.stringify({
                    event,
                    timestamp,
                    data: payload
                });

                const signature = crypto
                    .createHmac("sha256", webhook.secret)
                    .update(body)
                    .digest("hex");

                const response = await fetch(webhook.url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Webhook-Event": event,
                        "X-Webhook-Signature": `sha256=${signature}`,
                        "X-Webhook-Timestamp": timestamp.toString()
                    },
                    body,
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });

                if (response.ok) {
                    // Reset failure count on success
                    await Webhook.findByIdAndUpdate(webhook._id, {
                        lastTriggered: new Date(),
                        failureCount: 0
                    });
                } else {
                    console.error(`Webhook ${webhook._id} failed with status ${response.status}`);
                    await Webhook.findByIdAndUpdate(webhook._id, {
                        $inc: { failureCount: 1 },
                        lastTriggered: new Date()
                    });
                }
            } catch (err) {
                console.error(`Webhook ${webhook._id} error:`, err);
                await Webhook.findByIdAndUpdate(webhook._id, {
                    $inc: { failureCount: 1 }
                });
            }
        });

        // Don't await - fire and forget
        Promise.allSettled(promises);
    } catch (err) {
        console.error("Trigger webhooks error:", err);
    }
}
