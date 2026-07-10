const GROUPS: Record<string, string> = {
  Asia: "AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE",
  Europe: "AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA AX",
  "North America": "AG AI AW BS BB BZ BM CA KY CR CU CW DM DO SV GD GL GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC TT TC US VG VI",
  "South America": "AR BO BR CL CO EC FK GF GY PY PE SR UY VE",
  Africa: "DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW",
  Oceania: "AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF",
};

const LOOKUP = new Map<string, number>();
const NAMES = ["Asia", "Europe", "North America", "South America", "Africa", "Oceania", "Other"];
for (const [name, codes] of Object.entries(GROUPS)) {
  const index = NAMES.indexOf(name);
  for (const code of codes.split(" ")) LOOKUP.set(code, index);
}

export function continentOf(cc: string): number {
  return LOOKUP.get(cc) ?? 6;
}

export const CONTINENT_NAMES = NAMES;
