import { serviceClient } from "./auth.ts";

export type Plan = "free" | "pro" | "school";

export interface Entitlement {
  plan: Plan;
  status: string;
  isTrialing: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  aiDailyMessages: number;
  aiMonthlyMessages: number;
  imageAnalysis: boolean;
  canvasSync: boolean;
  schedulePhotoImport: boolean;
}

const PLAN_LIMITS: Record<
  Plan,
  Pick<
    Entitlement,
    | "aiDailyMessages"
    | "aiMonthlyMessages"
    | "imageAnalysis"
    | "canvasSync"
    | "schedulePhotoImport"
  >
> = {
  free: {
    aiDailyMessages: 10,
    aiMonthlyMessages: 50,
    imageAnalysis: false,
    canvasSync: false,
    schedulePhotoImport: false,
  },
  pro: {
    aiDailyMessages: 200,
    aiMonthlyMessages: 6000,
    imageAnalysis: true,
    canvasSync: true,
    schedulePhotoImport: true,
  },
  school: {
    aiDailyMessages: 500,
    aiMonthlyMessages: 15000,
    imageAnalysis: true,
    canvasSync: true,
    schedulePhotoImport: true,
  },
};

export async function getEntitlement(userId: string): Promise<Entitlement> {
  const db = serviceClient();
  const { data, error } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return buildEntitlement("free", "active", false, null, null, false);
  }

  const now = new Date();
  let plan: Plan = data.plan as Plan;
  let status: string = data.status;
  const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at) : null;

  // DB trial window (no Stripe): full Pro limits until trial_ends_at
  if (data.status === "trialing" && trialEnd) {
    if (now > trialEnd) {
      plan = "free";
      status = "trialing_expired";
    } else {
      plan = "pro";
    }
  } else if (data.status === "trialing" && !data.trial_ends_at) {
    plan = "pro";
  }

  if (data.status === "canceled" && data.current_period_end) {
    const periodEnd = new Date(data.current_period_end);
    if (now > periodEnd) {
      plan = "free";
      status = "canceled_expired";
    }
  }

  const effectivePlan = (status === "past_due") ? (data.plan as Plan) : plan;

  return buildEntitlement(
    effectivePlan,
    status,
    data.status === "trialing",
    data.trial_ends_at,
    data.current_period_end,
    data.cancel_at_period_end ?? false,
  );
}

function buildEntitlement(
  plan: Plan,
  status: string,
  isTrialing: boolean,
  trialEndsAt: string | null,
  currentPeriodEnd: string | null,
  cancelAtPeriodEnd: boolean,
): Entitlement {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  return {
    plan,
    status,
    isTrialing,
    trialEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    ...limits,
  };
}

export async function checkAILimit(
  userId: string,
  entitlement: Entitlement,
): Promise<{
  allowed: boolean;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number;
  monthlyLimit: number;
}> {
  const db = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthYear = new Date().toISOString().slice(0, 7);

  const { data } = await db
    .from("ai_usage")
    .select("message_count, month_year")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  const dailyUsed = data?.message_count ?? 0;

  const { data: monthData } = await db
    .from("ai_usage")
    .select("message_count")
    .eq("user_id", userId)
    .eq("month_year", monthYear);

  const monthlyUsed = (monthData ?? []).reduce(
    (sum: number, row: { message_count: number }) => sum + row.message_count,
    0,
  );

  const allowed =
    dailyUsed < entitlement.aiDailyMessages &&
    monthlyUsed < entitlement.aiMonthlyMessages;

  return {
    allowed,
    dailyUsed,
    monthlyUsed,
    dailyLimit: entitlement.aiDailyMessages,
    monthlyLimit: entitlement.aiMonthlyMessages,
  };
}

export async function incrementAIUsage(userId: string): Promise<void> {
  const db = serviceClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthYear = new Date().toISOString().slice(0, 7);

  const { error } = await db.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_date: today,
    p_month_year: monthYear,
  });
  if (error) console.error("increment_ai_usage RPC failed:", error);
}
