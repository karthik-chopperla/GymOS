import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import type { User } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAuthPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Synthetic contact number for email-only accounts (keeps legacy unique contactNumber). */
export function contactNumberForEmail(email: string): string {
  return `e:${normalizeAuthEmail(email)}`;
}

export type ProvisionOwnerInput = {
  name: string;
  password?: string;
} & (
  | { email: string; contactNumber?: never }
  | { email?: never; contactNumber: string }
);

export async function provisionOwnerAccount(
  input: ProvisionOwnerInput,
): Promise<User> {
  const email = input.email ? normalizeAuthEmail(input.email) : null;
  const contactNumber = input.contactNumber
    ? normalizeAuthPhone(input.contactNumber)
    : email
      ? contactNumberForEmail(email)
      : null;
  if (!contactNumber) {
    throw new Error("An email address or phone number is required");
  }
  const passwordHash = input.password
    ? await hash(input.password, 12)
    : await hash(randomBytes(32).toString("hex"), 12);

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        name: `${input.name.trim()}'s account`,
        plan: "FREE",
      },
    });

    await tx.gym.create({
      data: {
        accountId: account.id,
        name: "My Gym",
      },
    });

    return tx.user.create({
      data: {
        email,
        contactNumber,
        passwordHash,
        name: input.name.trim(),
        role: Role.ADMIN,
        mustChangePassword: false,
        isActive: true,
        accountId: account.id,
        AccountMembership: {
          create: {
            accountId: account.id,
            role: "OWNER",
            isActive: true,
          },
        },
      },
    });
  });
}

export async function findUserByLoginIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const normalizedEmail = trimmed.includes("@") ? normalizeAuthEmail(trimmed) : null;
  const normalizedPhone = normalizedEmail ? null : normalizeAuthPhone(trimmed);

  return prisma.user.findFirst({
    where: {
      OR: [
        { contactNumber: trimmed },
        ...(normalizedPhone ? [{ contactNumber: normalizedPhone }] : []),
        ...(normalizedEmail
          ? [{ email: normalizedEmail }, { contactNumber: contactNumberForEmail(normalizedEmail) }]
          : []),
      ],
    },
  });
}
