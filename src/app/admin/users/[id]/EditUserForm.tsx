"use client";

import { useActionState, useState } from "react";
import type { Permission, Role } from "@prisma/client";
import { updateAdmin, type UserFormState } from "@/app/actions/users";
import PermissionCheckboxes from "../PermissionCheckboxes";

export default function EditUserForm({
  userId,
  defaultRole,
  defaultName,
  defaultPermissions,
  isSelf,
}: {
  userId: string;
  defaultRole: Role;
  defaultName: string | null;
  defaultPermissions: Permission[];
  isSelf: boolean;
}) {
  const [role, setRole] = useState<Role>(defaultRole);

  const boundAction = updateAdmin.bind(null, userId);
  const [state, formAction, pending] = useActionState<UserFormState, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          บันทึกการเปลี่ยนแปลงแล้ว
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">
          ชื่อ (ไม่บังคับ)
        </span>
        <input
          name="name"
          type="text"
          defaultValue={defaultName ?? ""}
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {state?.fieldErrors?.name?.[0] && (
          <span className="mt-1 block text-xs text-red-600">
            {state.fieldErrors.name[0]}
          </span>
        )}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-700">
          Role
          {isSelf && (
            <span className="ml-2 text-[11px] font-normal text-amber-700">
              ⚠️ คุณห้ามลด role ของตัวเอง — ให้ SUPER_ADMIN คนอื่นทำแทน
            </span>
          )}
        </span>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN (มีทุกสิทธิ์)</option>
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">
          สิทธิ์เข้าถึงหมวด
          {role === "SUPER_ADMIN" && (
            <span className="ml-2 text-xs font-normal text-slate-500">
              (SUPER_ADMIN เข้าถึงได้ทุกหมวดโดยอัตโนมัติ)
            </span>
          )}
        </p>
        <PermissionCheckboxes
          key={role}
          defaultChecked={defaultPermissions}
          disabled={role === "SUPER_ADMIN"}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-green-800 px-4 py-2 text-sm font-semibold text-yellow-300 hover:bg-green-900 disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>
    </form>
  );
}
