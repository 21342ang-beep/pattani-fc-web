-- คงสิทธิ์การเข้าถึงเดิมของผู้ดูแลที่เคยได้รับสิทธิ์การ์ดเหล่านี้อยู่แล้ว
UPDATE "User"
SET "permissions" = array_append("permissions", 'ACCOUNT'::"Permission")
WHERE 'FINANCE'::"Permission" = ANY("permissions")
  AND NOT ('ACCOUNT'::"Permission" = ANY("permissions"));

UPDATE "User"
SET "permissions" = array_append("permissions", 'MEMBER_DATA'::"Permission")
WHERE 'CUSTOMERS'::"Permission" = ANY("permissions")
  AND NOT ('MEMBER_DATA'::"Permission" = ANY("permissions"));

UPDATE "User"
SET "permissions" = array_append("permissions", 'MATCH_RESULTS'::"Permission")
WHERE 'MATCHES'::"Permission" = ANY("permissions")
  AND NOT ('MATCH_RESULTS'::"Permission" = ANY("permissions"));

UPDATE "User"
SET "permissions" = array_append("permissions", 'BARCODE_MANAGEMENT'::"Permission")
WHERE 'GATE_CHECK'::"Permission" = ANY("permissions")
  AND NOT ('BARCODE_MANAGEMENT'::"Permission" = ANY("permissions"));
