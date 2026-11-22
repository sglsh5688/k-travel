"use strict";

const themes = {
  all: "All food",
  grill: "Grill",
  chicken: "Chicken",
  "raw-fish": "Raw Fish",
  soup: "Soup",
  "korean-chinese": "Korean-Chinese",
  western: "Western",
  cafe: "Café",
  mart: "Mart & CVS",
};

const origins = [
  { id: "myeongdong", name: "Myeongdong Station · Line 4", ko: "명동역 4호선", lat: 37.5609721, lng: 126.9864651, mapId: 424, type: "SUBWAY_STATION", rail: "myeongdong" },
  { id: "euljiro", name: "Euljiro 1-ga Station · Line 2", ko: "을지로입구역 2호선", lat: 37.5660349, lng: 126.9822413, mapId: 202, type: "SUBWAY_STATION", rail: "euljiro" },
  { id: "lotte-young-plaza", name: "Lotte Young Plaza · Bus stop 02142", ko: "명동.롯데영플라자", lat: 37.5629991, lng: 126.9821103, mapId: 104877, type: "BUS_STATION", rail: "euljiro" },
  { id: "myeongdong-exit-7", name: "Myeongdong Exit 7 · Bus stop 02234", ko: "명동역7번출구", lat: 37.561002, lng: 126.985316, mapId: 55037482, type: "BUS_STATION", rail: "myeongdong" },
];

const modes = {
  walk: { label: "Walk", icon: "directions_walk", web: "walk", app: "walk" },
  subway: { label: "Subway", icon: "directions_subway", web: "transit", app: "public" },
  bus: { label: "Bus", icon: "directions_bus", web: "transit", app: "public" },
  taxi: { label: "Taxi", icon: "local_taxi", web: "car", app: "car" },
};

const railPaths = {
  myeongdong: {
    "Myeongdong Station": [],
    "Euljiro 1-ga Station": ["Walk north through the Myeongdong shopping streets to Euljiro 1-ga Station."],
    "Euljiro 3-ga Station": ["Take Line 4 one stop to Chungmuro.", "Change to Line 3 toward Euljiro 3-ga and get off there."],
    "Hoehyeon Station": ["Take Line 4 toward Hoehyeon and get off at the next stop."],
    "City Hall Station": ["Take Line 4 toward Hoehyeon to Seoul Station.", "Change to Line 1 and get off at City Hall, one stop away."],
    "Jonggak Station": ["Take Line 4 toward Hoehyeon to Seoul Station.", "Change to Line 1 toward City Hall and get off at Jonggak, two stops away."],
    "Dongdaemun History & Culture Park Station": ["Take Line 4 toward Chungmuro. Get off at Dongdaemun History & Culture Park, two stops away."],
    "Sinnonhyeon Station": ["Take Line 4 one stop to Chungmuro.", "Change to Line 3 toward Dongguk University and get off at Express Bus Terminal.", "Change to Line 9 toward Sinnonhyeon and get off there."],
  },
  euljiro: {
    "Myeongdong Station": ["Walk south through the Myeongdong shopping streets to Myeongdong Station."],
    "Euljiro 1-ga Station": [],
    "Euljiro 3-ga Station": ["Take Line 2 one stop toward Euljiro 3-ga."],
    "Hoehyeon Station": ["Take Line 2 one stop to City Hall.", "Change to Line 1 one stop to Seoul Station, then take Line 4 one stop to Hoehyeon."],
    "City Hall Station": ["Take Line 2 one stop toward City Hall."],
    "Jonggak Station": ["Walk north across Cheonggyecheon stream to Jonggak Station."],
    "Dongdaemun History & Culture Park Station": ["Take Line 2 toward Euljiro 3-ga. Get off at Dongdaemun History & Culture Park, three stops away."],
    "Sinnonhyeon Station": ["Take Line 2 one stop to Euljiro 3-ga.", "Change to Line 3 toward Chungmuro and get off at Express Bus Terminal.", "Change to Line 9 toward Sinnonhyeon and get off there."],
  },
};

const venuesById = new Map(guideData.map((venue) => [venue.id, venue]));
const food = guideData.filter((venue) => venue.theme in themes);
const places = guideData.filter((venue) => venue.theme === "seongsu");
const $ = (id) => document.getElementById(id);
const venueDialog = $("venue-dialog");
const routeDialog = $("route-dialog");
const navLinks = document.querySelectorAll("[data-section]");
const won = new Intl.NumberFormat("en-SG");
const dollars = new Intl.NumberFormat("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const state = {
  origin: origins[0],
  routeMode: "walk",
  routeVenue: null,
};

try {
  state.origin = origins.find(({ id }) => id === localStorage.getItem("seoul-guide-origin")) ?? origins[0];
} catch {
  // The guide also works with browser storage disabled.
}

function make(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label) node.textContent = label;
  return node;
}

function icon(symbol) {
  const node = make("span", "icon", symbol);
  node.setAttribute("aria-hidden", "true");
  return node;
}

function button(label, symbol, handler, className = "action") {
  const node = make("button", className);
  node.type = "button";
  if (symbol) node.append(icon(symbol));
  node.append(label);
  node.addEventListener("click", handler);
  return node;
}

function link(label, href, className, symbol) {
  const node = make("a", className);
  node.href = href;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  if (symbol) node.append(icon(symbol));
  node.append(label);
  return node;
}

function placeUrl(venue, tab = "home") {
  return `https://m.place.naver.com/${venue.listing ?? "restaurant"}/${venue.id}/${tab}`;
}

function routePoint({ lat, lng, ko, mapId, type, id }) {
  // NAVER web share URLs use Web Mercator for route endpoints.
  const radius = 6378137;
  const radians = Math.PI / 180;
  const x = radius * lng * radians;
  const y = radius * Math.log(Math.tan(Math.PI / 4 + lat * radians / 2));
  return [x.toFixed(6), y.toFixed(6), encodeURIComponent(ko), mapId ?? id, type ?? "PLACE_POI"].join(",");
}

function webDirections(origin, venue, mode) {
  return `https://map.naver.com/p/directions/${routePoint(origin)}/${routePoint(venue)}/-/${mode.web}`;
}

function appDirections(origin, venue, mode) {
  const params = new URLSearchParams({
    slat: origin.lat, slng: origin.lng, sname: origin.name.split(" · ")[0],
    dlat: venue.lat, dlng: venue.lng, dname: venue.name,
    appname: location.protocol === "file:" ? "https://sglsh5688.github.io/k-travel/" : location.origin,
  });
  return `nmap://route/${mode.app}?${params.toString().replaceAll("+", "%20")}`;
}

function englishTransit(origin, venue) {
  const params = new URLSearchParams({
    api: "1",
    hl: "en",
    travelmode: "transit",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${venue.lat},${venue.lng}`,
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function photosOf(venue) {
  return venue.photos ?? [];
}

function image(src, alt, priority = false) {
  const node = make("img");
  node.alt = alt;
  node.loading = priority ? "eager" : "lazy";
  node.decoding = "async";
  node.referrerPolicy = "no-referrer";
  node.addEventListener("error", () => node.remove(), { once: true });
  node.src = src;
  return node;
}

function priceText(price) {
  if (!price) return ["Ask for price", ""];
  if (price === "varies") return ["Market price", ""];
  if (price === "free") return ["Free", ""];
  const isRange = Array.isArray(price);
  const numbers = isRange ? price : [price];
  return [
    numbers.map((value) => `S$${dollars.format(value / 1044)}`).join("–"),
    numbers.map((value) => `₩${won.format(value)}`).join("–"),
  ];
}

function priceNode(price) {
  const [sgd, krw] = priceText(price);
  const node = make("span");
  node.append(make("span", "card-price", sgd));
  if (krw) node.append(" ", make("span", "price-won", `(${krw})`));
  return node;
}

function card(venue, index) {
  const sectionLabel = venue.kind ?? themes[venue.theme];
  const node = make("article", "card");
  const photo = venue.cover ?? venue.menu?.find((item) => item.photo)?.photo ?? photosOf(venue)[0]?.url;
  const media = button("", venue.kind === "LP listening café" ? "headphones" : venue.kind ? "shopping_bag" : "restaurant",
    () => showVenue(venue), "card-media");
  media.setAttribute("aria-label", `View photos and details for ${venue.name}`);
  if (photo) media.append(image(photo, "", index < 3));
  node.append(media);

  const content = make("div", "card-content");
  const labels = make("div", "card-labels");
  labels.append(make("span", "pill", sectionLabel), make("span", "card-area", venue.area));
  if (venue.badge) labels.append(make("span", "pill green", venue.badge));
  content.append(labels);

  const title = make("div");
  const korean = make("p", "korean-name", venue.ko);
  korean.lang = "ko";
  title.append(make("h3", "", venue.name), korean);
  content.append(title, make("p", "card-description", venue.description));

  const facts = make("div", "card-facts");
  const hoursLine = make("div", "fact");
  hoursLine.append(icon("schedule"), make("span", "", venue.hours[0]));
  facts.append(hoursLine);
  if (venue.station) {
    const stationLine = make("div", "fact");
    stationLine.append(icon("directions_subway"), make("span", "", venue.station.label));
    facts.append(stationLine);
  }
  if (venue.menu?.length) {
    const priceLine = make("div", "fact");
    priceLine.append(icon("menu_book"), priceNode(venue.menu[0].price), make("span", "", venue.menu[0].short ?? venue.menu[0].name));
    facts.append(priceLine);
  }
  if (venue.pair) {
    const pairLine = make("div", "pair-summary");
    pairLine.append(make("span", "", "Estimate for two"), priceNode(venue.pair.price));
    facts.append(pairLine);
  }
  content.append(facts);

  const actions = make("div", "card-actions");
  actions.append(
    button(venue.menu?.length ? "Menu & photos" : "Details & photos", "photo_library", () => showVenue(venue)),
    button("Directions", "directions", () => showRoute(venue), "action primary"),
  );
  content.append(actions);
  node.append(content);
  return node;
}

function venueFacts(venue) {
  const facts = make("dl", "detail-facts");
  function add(label, values) {
    const dd = make("dd");
    for (const value of values) dd.append(value instanceof Node ? value : make("span", "", value));
    facts.append(make("dt", "", label), dd);
  }
  add("Hours", venue.hours);
  const address = make("span", "korean-name", venue.addressKo);
  address.lang = "ko";
  add("Address", [venue.address, address]);
  if (venue.station) add("Subway", [venue.station.label]);
  if (venue.bus) add("Bus stop", [venue.bus.label]);
  return facts;
}

function menuList(venue) {
  const list = make("ul", "menu-list");
  for (const item of venue.menu) {
    const row = make("li", "menu-row");
    if (item.photo) {
      const preview = link("", item.source ?? placeUrl(venue, "menu"), "menu-photo");
      preview.setAttribute("aria-label", `Open the source menu for ${item.name}`);
      preview.append(image(item.photo, ""));
      row.append(preview);
    }
    const copy = make("div", "menu-text");
    const korean = make("p", "korean-name", item.ko);
    korean.lang = "ko";
    copy.append(make("p", "menu-name", item.name), korean, make("p", "menu-note", item.note));
    const price = make("div", "menu-price");
    price.append(priceNode(item.price));
    row.append(copy, price);
    list.append(row);
  }
  return list;
}

function pairPlan(pair) {
  const section = make("section", "pair-plan");
  const header = make("div", "pair-header");
  header.append(make("h3", "", "Order for two"), priceNode(pair.price));
  section.append(header, make("p", "", pair.order));
  if (pair.source) {
    const source = make("p", "detail-source");
    source.append(link(pair.source.label, pair.source.url));
    section.append(source);
  }
  return section;
}

function showVenue(venue) {
  const heading = make("h2", "", venue.name);
  heading.id = "venue-heading";
  const nameKo = make("p", "korean-name", venue.ko);
  nameKo.lang = "ko";
  const content = $("venue-content");
  content.replaceChildren(heading, nameKo, make("p", "detail-intro", venue.detail ?? venue.description));
  if (venue.pair) content.append(pairPlan(venue.pair));
  content.append(venueFacts(venue));

  const photos = photosOf(venue);
  if (photos.length) {
    const section = make("section", "detail-section");
    section.append(make("h3", "", "Venue photos"));
    const grid = make("div", "photo-grid");
    for (const { url, caption, source } of photos) {
      const item = link("", source ?? placeUrl(venue, "photo"), "photo-preview");
      item.append(image(url, caption));
      grid.append(item);
    }
    section.append(grid);
    content.append(section);
  }

  if (venue.menu?.length) {
    const section = make("section", "detail-section");
    section.append(make("h3", "", venue.theme === "seongsu" ? "Admission" : "What to order"), menuList(venue));
    content.append(section);
  }

  const actions = make("div", "detail-actions");
  actions.append(
    button("Directions", "directions", () => showRoute(venue), "action primary"),
    link("Full photo gallery", placeUrl(venue, "photo"), "action", "photo_library"),
    link("NAVER listing", placeUrl(venue), "action", "location_on"),
  );
  if (venue.menu?.length && venue.theme !== "seongsu") {
    actions.append(link("Full menu", venue.menuSource ?? placeUrl(venue, "menu"), "action", "menu_book"));
  }
  content.append(actions);

  const source = make("p", "detail-source");
  if (venue.nameNote) source.append(`${venue.nameNote} `);
  source.append("Listing and photo gallery on NAVER Place.");
  if (venue.source) source.append(" ", link(venue.source.label, venue.source.url));
  content.append(source);

  venueDialog.showModal();
  venueDialog.scrollTop = 0;
}

function fillOriginSelect(select) {
  select.replaceChildren(...origins.map(({ id, name }) => new Option(name, id)));
  select.value = state.origin.id;
}

function setOrigin(id) {
  const origin = origins.find((item) => item.id === id);
  if (!origin) return;
  state.origin = origin;
  $("origin").value = origin.id;
  try {
    localStorage.setItem("seoul-guide-origin", origin.id);
  } catch {
    // Storage is optional.
  }
  if (routeDialog.open) updateRoute();
}

function railSteps(venue, origin) {
  const steps = [];
  const startingStation = origins.find((choice) => choice.id === origin.rail).name.split(" · ")[0];
  if (origin.type === "BUS_STATION") steps.push(`Walk from the bus stop to ${startingStation}.`);

  if (venue.rail) {
    steps.push(venue.rail[origin.rail]);
  } else {
    steps.push(...(railPaths[origin.rail][venue.station.name] ?? []));
  }
  if (venue.station.exit) {
    steps.push(`Leave ${venue.station.name} at Exit ${venue.station.exit}. Walk about ${venue.station.walk} min to ${venue.name}.`);
  }
  return steps;
}

function walkSteps(venue, origin) {
  const nearOrigin = origin.id === origin.rail && venue.station.name === origin.name.split(" · ")[0];
  if (nearOrigin && venue.station.exit) {
    return [`Leave through Exit ${venue.station.exit}. The venue is about ${venue.station.walk} min away on foot.`, venue.address];
  }
  const radians = Math.PI / 180;
  const x = (venue.lng - origin.lng) * Math.cos(origin.lat * radians);
  const y = venue.lat - origin.lat;
  const distance = Math.hypot(x, y) * radians * 6371000;
  const distanceText = distance < 1000 ? `${Math.round(distance / 10) * 10} m` : `${(distance / 1000).toFixed(1)} km`;
  return [
    `The destination is about ${distanceText} away in a straight line. NAVER Map gives the walking distance, turns and crossings.`,
    venue.address,
  ];
}

function routeSteps(venue, mode, origin) {
  if (mode === "subway") return railSteps(venue, origin);
  if (mode === "walk") return walkSteps(venue, origin);
  if (mode === "bus") {
    return [
      "Choose Bus in NAVER Map to get the boarding stop, bus number and live departures from your starting point.",
      `The closest listed stop to this venue is ${venue.bus.label}.`,
    ];
  }
  return [
    `Use ${origin.name.split(" · ")[0]} as your pickup area.`,
    `Show your driver the Korean destination below. NAVER Map can estimate the taxi fare and driving time.`,
  ];
}

function sharedRoute() {
  const [section, id, originId, mode] = location.hash.slice(1).split("/");
  const venue = venuesById.get(id);
  const origin = origins.find((choice) => choice.id === originId);
  return section === "route" && venue && origin && Object.hasOwn(modes, mode) ? { venue, origin, mode } : null;
}

async function copyRoute() {
  const url = new URL(location.href);
  url.hash = `route/${state.routeVenue.id}/${state.origin.id}/${state.routeMode}`;
  const status = $("route-feedback");
  try {
    await navigator.clipboard.writeText(url.href);
    status.textContent = "Link copied. Open it on your phone for NAVER Map English navigation.";
  } catch {
    $("route-copy-field").hidden = false;
    $("route-copy-field").value = url.href;
    $("route-copy-field").focus();
    $("route-copy-field").select();
    status.textContent = "Copy this link to open the same route on your phone.";
  }
}

function updateRoute() {
  const venue = state.routeVenue;
  const mode = modes[state.routeMode];
  for (const control of $("route-options").children) {
    control.setAttribute("aria-pressed", String(control.dataset.mode === state.routeMode));
  }
  $("route-web").href = webDirections(state.origin, venue, mode);
  $("route-app").href = appDirections(state.origin, venue, mode);
  $("route-transit").hidden = mode.web !== "transit";
  $("route-transit").href = englishTransit(state.origin, venue);
  $("route-transit").classList.toggle("primary", !isMobile() && mode.web === "transit");
  $("route-copy").classList.toggle("primary", !isMobile() && mode.web !== "transit");
  $("route-steps").replaceChildren(...routeSteps(venue, state.routeMode, state.origin).map((step) => make("li", "", step)));
  $("route-feedback").textContent = "";
  $("route-copy-field").hidden = true;
}

function showRoute(venue, mode = venue.rail ? "subway" : "walk") {
  state.routeVenue = venue;
  state.routeMode = mode;
  const heading = make("h2", "", "Directions");
  heading.id = "route-heading";
  const label = make("label", "form-label", "Start from");
  label.htmlFor = "route-origin";
  const select = make("select");
  select.id = "route-origin";
  fillOriginSelect(select);
  select.addEventListener("change", () => setOrigin(select.value));
  const wrap = make("div", "select-wrap");
  const dropdown = icon("arrow_drop_down");
  dropdown.classList.add("select-icon");
  wrap.append(select, dropdown);
  const form = make("div", "route-select");
  form.append(label, wrap);

  const options = make("div", "route-options");
  options.id = "route-options";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "Transport mode");
  for (const [value, mode] of Object.entries(modes)) {
    const control = button(mode.label, mode.icon, () => {
      state.routeMode = value;
      updateRoute();
    }, "action route-mode");
    control.dataset.mode = value;
    options.append(control);
  }

  const web = link("NAVER web map (Korean)", "https://map.naver.com/", "");
  web.id = "route-web";
  const app = make("a", "action primary");
  app.id = "route-app";
  app.hidden = !isMobile();
  app.append(icon("directions"), "Open NAVER Map app");
  const transit = link("Google Maps transit in English", "https://www.google.com/maps/", "action", "directions_subway");
  transit.id = "route-transit";
  const copy = button("Copy route for phone", "", copyRoute, "action");
  copy.id = "route-copy";
  const actions = make("div", "detail-actions route-actions");
  actions.append(app, transit, copy);
  const feedback = make("p", "route-feedback");
  feedback.id = "route-feedback";
  feedback.setAttribute("role", "status");
  const copyField = make("input", "route-copy-field");
  copyField.id = "route-copy-field";
  copyField.readOnly = true;
  copyField.hidden = true;
  copyField.setAttribute("aria-label", "Link for this route");
  const steps = make("ol", "route-steps");
  steps.id = "route-steps";
  steps.setAttribute("aria-live", "polite");
  const korean = make("p", "driver-address", `${venue.ko} · ${venue.addressKo}`);
  korean.lang = "ko";
  const address = make("div", "route-address");
  address.append(make("p", "form-label", "Address to show your driver"), korean);
  const help = make("div", "detail-source route-links");
  const language = make("details", "language-help");
  language.append(
    make("summary", "", "Set NAVER Map to English"),
    make("p", "", "On Android, open the NAVER Map menu and choose Settings, then Language, then English."),
    make("p", "", "On iPhone, open Settings, then Apps, then NAVER Map. Set Preferred Language to English."),
  );
  const downloads = make("p", "route-links");
  downloads.append(
    link("App Store", "https://apps.apple.com/sg/app/naver-maps-navigation/id311867728", ""),
    link("Google Play", "https://play.google.com/store/apps/details?id=com.nhn.android.nmap&hl=en", ""),
    link("NAVER language help", "https://help.naver.com/service/5637/contents/8275?lang=en", ""),
  );
  language.append(downloads);
  help.append(language, web);
  $("route-content").replaceChildren(
    heading, make("p", "detail-intro", venue.name), form, options, steps, actions,
    feedback, copyField, help, address,
  );
  updateRoute();
  if (!routeDialog.open) routeDialog.showModal();
  routeDialog.scrollTop = 0;
}

function searchText(venue) {
  return [venue.name, venue.ko, venue.area, venue.description,
    ...(venue.aliases ?? []), ...(venue.menu ?? []).flatMap(({ ko, name, note }) => [ko, name, note])]
    .join(" ").toLowerCase().normalize("NFKC");
}

function currentSection() {
  const [section, theme] = location.hash.slice(1).split("/");
  const route = sharedRoute();
  return {
    section: section === "places" || route?.venue.theme === "seongsu" ? "places" : "food",
    theme: Object.hasOwn(themes, theme) ? theme : "all",
  };
}

function updateFood() {
  const { theme } = currentSection();
  for (const filter of $("themes").children) filter.setAttribute("aria-pressed", String(filter.dataset.theme === theme));
  const tokens = $("search").value.toLowerCase().normalize("NFKC").trim().split(/\s+/).filter(Boolean);
  const matching = food.filter((venue) => (theme === "all" || venue.theme === theme) &&
    tokens.every((token) => searchText(venue).includes(token)));
  $("listing-count").textContent = `${matching.length} ${matching.length === 1 ? "spot" : "spots"}`;
  $("food-cards").replaceChildren(...matching.map(card));
  if (!matching.length) $("food-cards").append(make("p", "no-results", "No matches. Try another dish, name or neighbourhood."));
}

function renderSection() {
  const { section } = currentSection();
  for (const navLink of navLinks) {
    if (navLink.dataset.section === section) navLink.setAttribute("aria-current", "page");
    else navLink.removeAttribute("aria-current");
  }
  const showFood = section === "food";
  $("guide-heading").textContent = showFood ? "Food guide" : "Place guide";
  $("guide-description").textContent = showFood
    ? "Korean BBQ, fried chicken, comforts and cafés."
    : "Independent cafés, records and Korean fashion in Seongsu.";
  $("food-panel").hidden = !showFood;
  $("food-search").hidden = !showFood;
  $("places-panel").hidden = showFood;
  if (showFood) updateFood();
  const route = sharedRoute();
  if (route) {
    setOrigin(route.origin.id);
    showRoute(route.venue, route.mode);
  }
}

for (const [key, title] of Object.entries(themes)) {
  const filter = button(title, "", () => {
    if (currentSection().theme !== key) location.hash = key === "all" ? "food" : `food/${key}`;
  }, "theme");
  filter.dataset.theme = key;
  $("themes").append(filter);
}

$("place-cards").replaceChildren(...places.map(card));
for (const id of ["1170573670", "1107729911", "1656010116"]) {
  const venue = venuesById.get(id);
  if (venue) $("itinerary-stops").append(button(venue.itinerary ?? venue.name, "location_on", () => showRoute(venue)));
}

fillOriginSelect($("origin"));
$("origin").addEventListener("change", () => setOrigin($("origin").value));
$("search").addEventListener("input", updateFood);
window.addEventListener("hashchange", renderSection);
renderSection();
