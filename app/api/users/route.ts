import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isUserRole } from "@/lib/permissions";

export const runtime = "nodejs";

type CreateUserBody = {
  readonly displayName?: unknown;
  readonly email?: unknown;
  readonly password?: unknown;
  readonly role?: unknown;
};

const getBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
};

const getTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const forbidden = () =>
  NextResponse.json({ error: "Only master users can create users." }, { status: 403 });

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let body: CreateUserBody;
  try {
    body = (await request.json()) as CreateUserBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const displayName = getTrimmedString(body.displayName);
  const email = getTrimmedString(body.email).toLowerCase();
  const password = getTrimmedString(body.password);
  const role = body.role;

  if (!displayName || !email || !password || !isUserRole(role)) {
    return NextResponse.json({ error: "Missing or invalid user fields." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const requesterSnapshot = await adminDb
      .ref(`users/${decodedToken.uid}`)
      .get();
    const requester = requesterSnapshot.val() as
      | { role?: unknown; status?: unknown }
      | null;

    if (requester?.role !== "master" || requester.status === "inactive") {
      return forbidden();
    }

    const createdUser = await adminAuth.createUser({
      displayName,
      email,
      password,
      disabled: false,
    });

    const now = Date.now();

    try {
      await adminDb.ref(`users/${createdUser.uid}`).set({
        displayName,
        email,
        role,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      await adminAuth.deleteUser(createdUser.uid);
      throw error;
    }

    return NextResponse.json({
      uid: createdUser.uid,
      displayName,
      email,
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: unknown) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";

    if (code === "auth/id-token-expired" || code === "auth/argument-error") {
      return NextResponse.json({ error: "Invalid authorization token." }, { status: 401 });
    }

    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
    }

    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
