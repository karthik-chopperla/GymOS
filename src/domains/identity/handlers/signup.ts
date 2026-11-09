import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiErrors } from "@/lib/api-handler";
import { parseJsonBody } from "@/lib/security/parse-json-body";
import {
  normalizeAuthEmail,
  normalizeAuthPhone,
  provisionOwnerAccount,
} from "@/lib/auth/provision-owner";

const signupSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Email or phone number is required")
    .max(254)
    .refine((value) => {
      if (value.includes("@")) {
        return z.string().email().safeParse(value).success;
      }
      const phone = normalizeAuthPhone(value);
      return phone.length >= 7 && phone.length <= 15;
    }, "Enter a valid email address or phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
});

export async function signupHandler(request: NextRequest) {
  const parsed = await parseJsonBody(request, signupSchema);
  if (!parsed.ok) return parsed.response;

  const isEmail = parsed.data.identifier.includes("@");
  const email = isEmail ? normalizeAuthEmail(parsed.data.identifier) : null;
  const contactNumber = isEmail
    ? null
    : normalizeAuthPhone(parsed.data.identifier);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }, { contactNumber: `e:${email}` }] : []),
        ...(contactNumber ? [{ contactNumber }] : []),
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return ApiErrors.validationError("An account with this email or phone number already exists");
  }

  const ownerInput = {
    name: parsed.data.name,
    password: parsed.data.password,
  };
  const user = await provisionOwnerAccount(
    email
      ? { ...ownerInput, email }
      : { ...ownerInput, contactNumber: normalizeAuthPhone(parsed.data.identifier) },
  );

  return NextResponse.json(
    {
      success: true,
      userId: user.id,
      message: "Account created. You can sign in now.",
    },
    { status: 201 },
  );
}
