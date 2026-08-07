export type ProvinceCoordinate = {
  latitude: number;
  longitude: number;
};

const PROVINCE_COORDINATES: Record<string, ProvinceCoordinate> = {
  กรุงเทพมหานคร: { latitude: 13.756, longitude: 100.501 },
  กระบี่: { latitude: 8.086, longitude: 98.906 },
  กาญจนบุรี: { latitude: 14.02, longitude: 99.53 },
  กาฬสินธุ์: { latitude: 16.43, longitude: 103.51 },
  กำแพงเพชร: { latitude: 16.48, longitude: 99.52 },
  ขอนแก่น: { latitude: 16.43, longitude: 102.82 },
  จันทบุรี: { latitude: 12.611, longitude: 102.104 },
  ฉะเชิงเทรา: { latitude: 13.69, longitude: 101.077 },
  ชลบุรี: { latitude: 13.361, longitude: 100.984 },
  ชัยนาท: { latitude: 15.185, longitude: 100.125 },
  ชัยภูมิ: { latitude: 15.806, longitude: 102.031 },
  ชุมพร: { latitude: 10.493, longitude: 99.18 },
  เชียงราย: { latitude: 19.91, longitude: 99.84 },
  เชียงใหม่: { latitude: 18.788, longitude: 98.986 },
  ตรัง: { latitude: 7.56, longitude: 99.61 },
  ตราด: { latitude: 12.24, longitude: 102.52 },
  ตาก: { latitude: 16.88, longitude: 99.12 },
  นครนายก: { latitude: 14.2, longitude: 101.21 },
  นครปฐม: { latitude: 13.82, longitude: 100.06 },
  นครพนม: { latitude: 17.41, longitude: 104.78 },
  นครราชสีมา: { latitude: 14.97, longitude: 102.1 },
  นครศรีธรรมราช: { latitude: 8.43, longitude: 99.96 },
  นครสวรรค์: { latitude: 15.7, longitude: 100.14 },
  นนทบุรี: { latitude: 13.86, longitude: 100.51 },
  นราธิวาส: { latitude: 6.43, longitude: 101.82 },
  น่าน: { latitude: 18.78, longitude: 100.77 },
  บึงกาฬ: { latitude: 18.36, longitude: 103.646 },
  บุรีรัมย์: { latitude: 14.993, longitude: 103.102 },
  ปทุมธานี: { latitude: 14.02, longitude: 100.53 },
  ประจวบคีรีขันธ์: { latitude: 11.81, longitude: 99.8 },
  ปราจีนบุรี: { latitude: 14.05, longitude: 101.37 },
  ปัตตานี: { latitude: 6.87, longitude: 101.25 },
  พระนครศรีอยุธยา: { latitude: 14.35, longitude: 100.56 },
  พะเยา: { latitude: 19.17, longitude: 99.9 },
  พังงา: { latitude: 8.45, longitude: 98.53 },
  พัทลุง: { latitude: 7.62, longitude: 100.08 },
  พิจิตร: { latitude: 16.44, longitude: 100.35 },
  พิษณุโลก: { latitude: 16.82, longitude: 100.26 },
  เพชรบุรี: { latitude: 13.11, longitude: 99.94 },
  เพชรบูรณ์: { latitude: 16.42, longitude: 101.16 },
  แพร่: { latitude: 18.14, longitude: 100.14 },
  ภูเก็ต: { latitude: 7.88, longitude: 98.39 },
  มหาสารคาม: { latitude: 16.18, longitude: 103.3 },
  มุกดาหาร: { latitude: 16.54, longitude: 104.72 },
  แม่ฮ่องสอน: { latitude: 19.3, longitude: 97.97 },
  ยโสธร: { latitude: 15.79, longitude: 104.15 },
  ยะลา: { latitude: 6.54, longitude: 101.28 },
  ร้อยเอ็ด: { latitude: 16.05, longitude: 103.65 },
  ระนอง: { latitude: 9.96, longitude: 98.64 },
  ระยอง: { latitude: 12.68, longitude: 101.28 },
  ราชบุรี: { latitude: 13.53, longitude: 99.82 },
  ลพบุรี: { latitude: 14.8, longitude: 100.65 },
  ลำปาง: { latitude: 18.29, longitude: 99.49 },
  ลำพูน: { latitude: 18.58, longitude: 99.01 },
  เลย: { latitude: 17.49, longitude: 101.72 },
  ศรีสะเกษ: { latitude: 15.12, longitude: 104.32 },
  สกลนคร: { latitude: 17.17, longitude: 104.15 },
  สงขลา: { latitude: 7.19, longitude: 100.6 },
  สตูล: { latitude: 6.62, longitude: 100.07 },
  สมุทรปราการ: { latitude: 13.6, longitude: 100.6 },
  สมุทรสงคราม: { latitude: 13.41, longitude: 99.998 },
  สมุทรสาคร: { latitude: 13.55, longitude: 100.27 },
  สระแก้ว: { latitude: 13.82, longitude: 102.06 },
  สระบุรี: { latitude: 14.53, longitude: 100.91 },
  สิงห์บุรี: { latitude: 14.89, longitude: 100.4 },
  สุโขทัย: { latitude: 17.0, longitude: 99.82 },
  สุพรรณบุรี: { latitude: 14.47, longitude: 100.12 },
  สุราษฎร์ธานี: { latitude: 9.14, longitude: 99.32 },
  สุรินทร์: { latitude: 14.88, longitude: 103.49 },
  หนองคาย: { latitude: 17.88, longitude: 102.74 },
  หนองบัวลำภู: { latitude: 17.2, longitude: 102.44 },
  อ่างทอง: { latitude: 14.589, longitude: 100.455 },
  อำนาจเจริญ: { latitude: 15.865, longitude: 104.625 },
  อุดรธานี: { latitude: 17.41, longitude: 102.79 },
  อุตรดิตถ์: { latitude: 17.62, longitude: 100.1 },
  อุทัยธานี: { latitude: 15.38, longitude: 100.02 },
  อุบลราชธานี: { latitude: 15.24, longitude: 104.85 },
};

const PROVINCE_ALIASES: Record<string, string> = {
  กรุงเทพ: "กรุงเทพมหานคร",
  กรุงเทพฯ: "กรุงเทพมหานคร",
  กทม: "กรุงเทพมหานคร",
  "กทม.": "กรุงเทพมหานคร",
};

export function getThaiProvinceCoordinate(
  province: string,
): ProvinceCoordinate | null {
  const canonical = normalizeThaiProvinceName(province);
  return PROVINCE_COORDINATES[canonical] ?? null;
}

export function normalizeThaiProvinceName(province: string): string {
  const normalized = province.trim().replace(/^จังหวัด\s*/, "");
  return PROVINCE_ALIASES[normalized] ?? normalized;
}
