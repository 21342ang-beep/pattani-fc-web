import config from "@payload-config";
import { getPayload } from "payload";

async function main() {
  const mode = process.env.CMS_BOOTSTRAP_MODE;
  const email = process.env.CMS_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.CMS_SUPER_ADMIN_PASSWORD;

  if (mode !== "fresh" && mode !== "existing") {
    throw new Error("CMS_BOOTSTRAP_MODE must be fresh or existing");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("CMS_SUPER_ADMIN_EMAIL must be an exact valid email");
  }

  const payload = await getPayload({ config });
  try {
    const existingUsers = await payload.find({
      collection: "cms-users",
      limit: 2,
      depth: 0,
      overrideAccess: true,
    });

    if (mode === "fresh") {
      if (existingUsers.totalDocs !== 0) {
        throw new Error("Fresh CMS bootstrap refused because a CMS user already exists");
      }
      if (!password || password.length < 20) {
        throw new Error("Fresh CMS bootstrap password must contain at least 20 characters");
      }
      await payload.create({
        collection: "cms-users",
        overrideAccess: true,
        data: {
          email,
          password,
          role: "super-admin",
        },
      });
    } else {
      const matches = await payload.find({
        collection: "cms-users",
        where: { email: { equals: email } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      });
      if (matches.totalDocs !== 1 || !matches.docs[0]) {
        throw new Error(
          "Existing CMS bootstrap requires exactly one user matching CMS_SUPER_ADMIN_EMAIL",
        );
      }
      if (matches.docs[0].role !== "super-admin") {
        await payload.update({
          collection: "cms-users",
          id: matches.docs[0].id,
          overrideAccess: true,
          data: { role: "super-admin" },
        });
      }
    }

    const superAdmins = await payload.find({
      collection: "cms-users",
      where: { role: { equals: "super-admin" } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (superAdmins.totalDocs < 1) {
      throw new Error("CMS bootstrap verification failed: no super-admin exists");
    }
    console.log("CMS super-admin bootstrap verified");
  } finally {
    await payload.destroy();
  }
}

void main().then(
  () => {
    process.exit(0);
  },
  (error: unknown) => {
    console.error("CMS super-admin bootstrap failed", error);
    process.exit(1);
  },
);
