import { NextRequest, NextResponse } from "next/server";
import getServerSession from "next-auth";
import { authConfig } from "~/server/auth/config";
import { supabase } from "~/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig, request);

    if (!session?.user?.pan || !session?.user?.gst) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { pan, gst, hydrogenProduced, electricityConsumed } = body;

    if (pan !== session.user.pan || gst !== session.user.gst) {
      return NextResponse.json({ error: "PAN/GST mismatch" }, { status: 403 });
    }

    if (
      !hydrogenProduced ||
      !electricityConsumed ||
      hydrogenProduced <= 0 ||
      electricityConsumed <= 0
    ) {
      return NextResponse.json(
        { error: "Amounts must be positive numbers" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("unverified")
      .insert([
        {
          pan,
          gst,
          hydrogen_produced: hydrogenProduced,
          electricity_consumed: electricityConsumed,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to save data" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig, request);

    if (!session?.user?.pan)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const userPan = searchParams.get("pan");
    const userGst = searchParams.get("gst");

    if (userPan !== session.user.pan || userGst !== session.user.gst) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [unverifiedResp, verifiedResp] = await Promise.all([
      supabase
        .from("unverified")
        .select("*")
        .eq("pan", userPan)
        .order("created_at", { ascending: false }),
      supabase
        .from("verified")
        .select("*")
        .eq("pan", userPan)
        .order("created_at", { ascending: false }),
    ]);

    if (unverifiedResp.error || verifiedResp.error) {
      console.error(unverifiedResp.error || verifiedResp.error);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 },
      );
    }

    const unverifiedRecords = (unverifiedResp.data || []).map((r) => ({
      ...r,
      verified: false,
    }));
    const verifiedRecords = (verifiedResp.data || []).map((r) => ({
      ...r,
      verified: true,
    }));

    const allRecords = [...unverifiedRecords, ...verifiedRecords].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return NextResponse.json(allRecords);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
