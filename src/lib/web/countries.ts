/**
 * Countries for Local research, grouped by region so "nearby" means the same region.
 * Entry format: code:Name:other words for it (used to notice a mention in English text).
 */
const REGIONS: Record<string, string> = {
  "South-East Asia":
    "bn:Brunei:Bruneian,kh:Cambodia:Cambodian|Khmer,id:Indonesia:Indonesian,la:Laos:Lao|Laotian,my:Malaysia:Malaysian,mm:Myanmar:Burma|Burmese,ph:Philippines:Filipino|Philippine,sg:Singapore:Singaporean,th:Thailand:Thai,tl:Timor-Leste:East Timor|Timorese,vn:Vietnam:Vietnamese|Viet Nam",
  "East Asia": "cn:China:Chinese,hk:Hong Kong:,jp:Japan:Japanese,mo:Macau:Macao,mn:Mongolia:Mongolian,kp:North Korea:North Korean,kr:South Korea:South Korean|Korean,tw:Taiwan:Taiwanese",
  "South Asia": "af:Afghanistan:Afghan,bd:Bangladesh:Bangladeshi,bt:Bhutan:Bhutanese,in:India:Indian,mv:Maldives:Maldivian,np:Nepal:Nepalese|Nepali,pk:Pakistan:Pakistani,lk:Sri Lanka:Sri Lankan",
  "Central Asia": "kz:Kazakhstan:Kazakh|Kazakhstani,kg:Kyrgyzstan:Kyrgyz,tj:Tajikistan:Tajik,tm:Turkmenistan:Turkmen,uz:Uzbekistan:Uzbek",
  "Western Asia":
    "am:Armenia:Armenian,az:Azerbaijan:Azerbaijani,bh:Bahrain:Bahraini,cy:Cyprus:Cypriot,ge:Georgia:,ir:Iran:Iranian,iq:Iraq:Iraqi,il:Israel:Israeli,jo:Jordan:Jordanian,kw:Kuwait:Kuwaiti,lb:Lebanon:Lebanese,om:Oman:Omani,ps:Palestine:Palestinian,qa:Qatar:Qatari,sa:Saudi Arabia:Saudi,sy:Syria:Syrian,tr:Turkey:Turkish|Türkiye,ae:United Arab Emirates:UAE|Emirati,ye:Yemen:Yemeni",
  "Northern Europe":
    "dk:Denmark:Danish,ee:Estonia:Estonian,fi:Finland:Finnish,is:Iceland:Icelandic,ie:Ireland:Irish,lv:Latvia:Latvian,lt:Lithuania:Lithuanian,no:Norway:Norwegian,se:Sweden:Swedish,gb:United Kingdom:UK|U.K.|British|Britain|England|Scotland|Wales",
  "Western Europe": "at:Austria:Austrian,be:Belgium:Belgian,fr:France:French,de:Germany:German,li:Liechtenstein:,lu:Luxembourg:Luxembourgish,mc:Monaco:,nl:Netherlands:Dutch,ch:Switzerland:Swiss",
  "Southern Europe":
    "al:Albania:Albanian,ad:Andorra:Andorran,ba:Bosnia and Herzegovina:Bosnian|Bosnia,hr:Croatia:Croatian,gr:Greece:Greek,it:Italy:Italian,xk:Kosovo:Kosovar,mt:Malta:Maltese,me:Montenegro:Montenegrin,mk:North Macedonia:Macedonian,pt:Portugal:Portuguese,sm:San Marino:,rs:Serbia:Serbian,si:Slovenia:Slovenian,es:Spain:Spanish",
  "Eastern Europe": "by:Belarus:Belarusian,bg:Bulgaria:Bulgarian,cz:Czech Republic:Czechia|Czech,hu:Hungary:Hungarian,md:Moldova:Moldovan,pl:Poland:Polish,ro:Romania:Romanian,ru:Russia:Russian,sk:Slovakia:Slovak,ua:Ukraine:Ukrainian",
  "Northern Africa": "dz:Algeria:Algerian,eg:Egypt:Egyptian,ly:Libya:Libyan,ma:Morocco:Moroccan,sd:Sudan:Sudanese,tn:Tunisia:Tunisian",
  "Western Africa":
    "bj:Benin:Beninese,bf:Burkina Faso:Burkinabe,cv:Cape Verde:Cabo Verde,ci:Ivory Coast:Côte d'Ivoire|Ivorian,gm:Gambia:Gambian,gh:Ghana:Ghanaian,gn:Guinea:Guinean,gw:Guinea-Bissau:,lr:Liberia:Liberian,ml:Mali:Malian,mr:Mauritania:Mauritanian,ne:Niger:Nigerien,ng:Nigeria:Nigerian,sn:Senegal:Senegalese,sl:Sierra Leone:Sierra Leonean,tg:Togo:Togolese",
  "Central Africa": "ao:Angola:Angolan,cm:Cameroon:Cameroonian,cf:Central African Republic:,td:Chad:Chadian,cg:Republic of the Congo:Congo,cd:DR Congo:Democratic Republic of the Congo|Democratic Republic of Congo|Congolese,gq:Equatorial Guinea:,ga:Gabon:Gabonese,st:São Tomé and Príncipe:Sao Tome",
  "Eastern Africa":
    "bi:Burundi:Burundian,km:Comoros:Comorian,dj:Djibouti:Djiboutian,er:Eritrea:Eritrean,et:Ethiopia:Ethiopian,ke:Kenya:Kenyan,mg:Madagascar:Malagasy,mw:Malawi:Malawian,mu:Mauritius:Mauritian,mz:Mozambique:Mozambican,rw:Rwanda:Rwandan,sc:Seychelles:,so:Somalia:Somali,ss:South Sudan:South Sudanese,tz:Tanzania:Tanzanian,ug:Uganda:Ugandan,zm:Zambia:Zambian,zw:Zimbabwe:Zimbabwean",
  "Southern Africa": "bw:Botswana:,sz:Eswatini:Swaziland,ls:Lesotho:,na:Namibia:Namibian,za:South Africa:South African",
  "North America": "ca:Canada:Canadian,us:United States:USA|U.S.|United States of America",
  "Central America and Mexico": "bz:Belize:,cr:Costa Rica:Costa Rican,sv:El Salvador:Salvadoran,gt:Guatemala:Guatemalan,hn:Honduras:Honduran,mx:Mexico:Mexican,ni:Nicaragua:Nicaraguan,pa:Panama:Panamanian",
  Caribbean:
    "ag:Antigua and Barbuda:,bs:Bahamas:Bahamian,bb:Barbados:Barbadian,cu:Cuba:Cuban,dm:Dominica:,do:Dominican Republic:,gd:Grenada:Grenadian,ht:Haiti:Haitian,jm:Jamaica:Jamaican,pr:Puerto Rico:Puerto Rican,kn:Saint Kitts and Nevis:,lc:Saint Lucia:,vc:Saint Vincent and the Grenadines:,tt:Trinidad and Tobago:Trinidadian",
  "South America": "ar:Argentina:Argentine|Argentinian,bo:Bolivia:Bolivian,br:Brazil:Brazilian,cl:Chile:Chilean,co:Colombia:Colombian,ec:Ecuador:Ecuadorian,gy:Guyana:Guyanese,py:Paraguay:Paraguayan,pe:Peru:Peruvian,sr:Suriname:Surinamese,uy:Uruguay:Uruguayan,ve:Venezuela:Venezuelan",
  Oceania:
    "au:Australia:Australian,fj:Fiji:Fijian,ki:Kiribati:,mh:Marshall Islands:,fm:Micronesia:,nr:Nauru:,nz:New Zealand:New Zealander,pw:Palau:,pg:Papua New Guinea:,ws:Samoa:Samoan,sb:Solomon Islands:,to:Tonga:Tongan,tv:Tuvalu:,vu:Vanuatu:",
};

export interface Country {
  code: string;
  name: string;
  words: string[];
  region: string;
}

export const MAX_COUNTRIES = 3;

const ALL = Object.entries(REGIONS).flatMap(([region, list]) =>
  list.split(",").map((e): Country => {
    const [code, name, other] = e.split(":");
    return { code, name, words: [name, ...(other ? other.split("|") : [])], region };
  }),
);
const BY_CODE = new Map(ALL.map((c) => [c.code, c]));

export const COUNTRIES: readonly Country[] = [...ALL].sort((a, b) => a.name.localeCompare(b.name, "en"));
export const COUNTRY_CODES = ALL.map((c) => c.code) as [string, ...string[]];

export const countriesOf = (codes: readonly string[]): Country[] => codes.flatMap((c) => BY_CODE.get(c) ?? []);

/** Other countries in the same regions. */
export function nearbyCountries(chosen: readonly Country[]): Country[] {
  return ALL.filter((c) => chosen.some((x) => x.region === c.region) && !chosen.includes(c));
}

/** Capitals matter, so "Polish" isn't found in "polish" and "Turkey" isn't found in "turkey". */
export function mentions(text: string, c: Country): boolean {
  const rest = c.words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${rest})(?![\\p{L}\\p{N}])`, "gu");
  // Names that are part of another country's name or a common other place.
  const t = text.replace(/New South Wales|New Mexico|Papua New Guinea|Equatorial Guinea|Guinea-Bissau|Northern Ireland|South Sudan|American Indians?|West Indian/g, (m) => (c.words.includes(m) ? m : " "));
  return re.test(t);
}

export const listNames = (cs: readonly Country[]): string =>
  cs.length < 2 ? (cs[0]?.name ?? "") : `${cs.slice(0, -1).map((c) => c.name).join(", ")} or ${cs[cs.length - 1].name}`;

export type Closeness = "country" | "authors" | "nearby" | "world";

export interface Place {
  closeness: Closeness;
  /** Always says what is not ensured: keyword matches can't prove where something happened. */
  text: string;
}

/** How close a result is to the chosen countries, judged only from its own words and its authors' countries. */
export function placeOf(r: { title: string; text: string; authorCountries?: readonly string[] }, chosen: readonly Country[]): Place {
  const all = `${r.title} ${r.text}`;
  const named = chosen.filter((c) => mentions(all, c));
  if (named.length) return { closeness: "country", text: `Mentions ${listNames(named)}. Not ensured that it happened there.` };
  const based = chosen.filter((c) => r.authorCountries?.includes(c.code));
  if (based.length) return { closeness: "authors", text: `Written by authors in ${listNames(based)}. The country of the evidence is not ensured.` };
  const near = nearbyCountries(chosen).filter((c) => mentions(all, c));
  if (near.length) return { closeness: "nearby", text: `Mentions ${listNames(near.slice(0, 2))}, in the same region. Not ensured for ${listNames(chosen)}.` };
  return { closeness: "world", text: `Worldwide result. Not ensured for ${listNames(chosen)}.` };
}

const ORDER: Closeness[] = ["country", "authors", "nearby", "world"];

/** Closest first, keeping the original order within each level. Farther levels only fill the list up to `enough`. */
export function closestFirst<T extends { place?: Place }>(rows: T[], enough: number, max: number): T[] {
  const out: T[] = [];
  for (const level of ORDER) {
    const at = rows.filter((r) => (r.place?.closeness ?? "world") === level);
    out.push(...at.slice(0, Math.max(0, (level === "country" ? max : enough) - out.length)));
  }
  return out;
}
