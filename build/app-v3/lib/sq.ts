// All Albanian copy in one place (01-product-design.md §9), so the language can be reviewed in one file.
// Tone: "ti", short verbs first, 24-hour times, prices as "5 €".

export const sq = {
  brand: {
    termini: 'termini',
    faqjaGati: 'Faqja Gati',
    bookedVia: 'Rezervuar përmes',
    bookingVia: 'Rezervim përmes',
    haveBusiness: 'Ke biznes?',
    getLink: 'Merre linkun tënd falas.',
    tagCustomers: 'Rezervo terminin në 20 sekonda.',
    tagBusiness: 'Më pak thirrje. Më shumë klientë.',
    tagPage: 'Faqja e biznesit tënd, gati në 2 minuta.',
  },

  common: {
    back: 'Kthehu', next: 'Vazhdo', save: 'Ruaj', saved: 'U ruajt.', saveFailed: "S'u ruajt. Provo përsëri.",
    close: 'Mbyll', undo: 'Zhbëj', closed: 'Mbyllur', today: 'Sot', tomorrow: 'Nesër', step: 'Hapi',
    offline: "S'ka internet. Kontrollo lidhjen.", failed: 'Diçka shkoi keq. Provo përsëri.',
    linkCopied: 'Linku u kopjua.', optional: '(nëse do)', ifAny: '(nëse ke)', other: 'Tjetër',
    priceOnSite: 'Çmimi në lokal', min: 'min', call: 'Thirr', whatsapp: 'WhatsApp', soon: 'së shpejti',
    yes: 'Po', no: 'Jo', open: 'Hap', loading: 'Po ngarkohet',
  },

  /** Error pages (app/error.tsx, app/global-error.tsx). */
  errorPage: {
    title: 'Diçka shkoi keq', text: 'Nuk është faji yt. Provo përsëri; nëse vazhdon, na shkruaj në WhatsApp.',
    retry: 'Provo përsëri', home: 'Kthehu në fillim', code: (d: string) => `Kodi i gabimit: ${d}`,
  },

  categories: {
    berber: 'Berber', salon: 'Sallon bukurie', dentist: 'Dentist', klinike: 'Klinikë', bujtine: 'Bujtinë',
    restorant: 'Restorant', dyqan: 'Dyqan', dasma: 'Sallon dasmash', autoshkolla: 'Autoshkollë', lavazh: 'Lavazh dhe servis', tjeter: 'Tjetër',
  } as Record<string, string>,
  categoriesShort: { berber: 'Berber', salon: 'Sallon', dentist: 'Dentist', klinike: 'Klinikë', bujtine: 'Bujtinë', dasma: 'Sallon dasmash', autoshkolla: 'Autoshkollë', lavazh: 'Lavazh', tjeter: 'Tjetër' } as Record<string, string>,
  /** "I kemi shtuar shërbimet e zakonshme për {…}." */
  categoriesFor: { berber: 'berberë', salon: 'sallone', dentist: 'dentistë', klinike: 'klinika', bujtine: 'bujtina', dasma: 'sallone dasmash', autoshkolla: 'autoshkolla', lavazh: 'lavazhe dhe servise', tjeter: 'biznesin tënd' } as Record<string, string>,
  cities: ['Gjakovë', 'Prishtinë', 'Prizren', 'Pejë', 'Ferizaj', 'Gjilan', 'Mitrovicë', 'Tjetër'],

  /* ---- errors returned by the API (code → text) ------------------------- */
  errors: {
    slot_taken: 'Kjo orë sapo u zu. Zgjidh një tjetër.',
    invalid_phone: 'Shkruaj një numër të vlefshëm, p.sh. 044 123 456.',
    name_required: 'Shkruaj emrin.',
    too_many_active: 'Ke tashmë 3 termine aktive këtu. Anulo një për të rezervuar tjetër.',
    rate_limited: 'Shumë tentime. Provo përsëri pas pak minutash.',
    code_not_sent: "S'e dërguam dot kodin. Provo përsëri pas pak ose na shkruaj në WhatsApp.",
    storage_failed: "S'e ruajtëm dot foton. Provo përsëri pas pak.",
    daily_cap: 'Sot kemi shumë kërkesa. Na shkruaj në WhatsApp dhe ta bëjmë faqen ne.',
    too_many_new: (phone: string) => `Shumë rezervime të reja njëherësh. Provo pas pak ose thirr në ${phone}.`,
    blocked: "Rezervimi online s'është i mundur për këtë numër. Thirr në lokal.",
    paused: (biz: string, phone: string) => `${biz} nuk pranon rezervime online tani. Thirr në ${phone}.`,
    too_late: (hours: string, phone: string) => `Deri te termini kanë mbetur më pak se ${hours}. Thirr në ${phone} për ta anuluar.`,
    not_found: 'Kjo faqe nuk ekziston. Kontrollo linkun.',
    unauthorized: 'Hyr në llogari për të vazhduar.',
    forbidden: "S'ke leje për këtë veprim.",
    bad_request: 'Kontrollo të dhënat dhe provo përsëri.',
    wrong_code: "Kodi s'është i saktë. Provo përsëri.",
    code_expired: 'Kodi skadoi. Dërgo një të ri.',
    slug_taken: (s: string) => `Ky link është i zënë. Provo: ${s}`,
    overlap: (name: string) => `Në këtë orë ke termin me ${name}. Ruaje gjithsesi?`,
    day_has_bookings: (n: number) => `Ke ${n} ${n === 1 ? 'termin' : 'termine'} këtë ditë. Anuloji ose zhvendosi më parë.`,
    service_name: 'Shkruaj emrin e shërbimit.',
    business_name: 'Shkruaj emrin e biznesit.',
    hours_order: 'Ora e mbylljes duhet të jetë pas hapjes.',
    no_service: 'Shto të paktën një shërbim.',
    // Audit fix: the server's sharp build has no HEIC (HEVC) decoder. Without image/heic in `accept`, iPhones
    // convert photos to JPEG on their own, so "HEIC" is no longer promised here.
    photo_type: 'Vetëm foto JPG, PNG ose WebP.',
    photo_max: 'Mund të ngarkosh deri në 10 foto.',
    revisions_used: 'I ke përdorur 3 ndryshimet falas. Na shkruaj në WhatsApp për ndryshime të tjera.',
    pages_limit: 'Ke arritur kufirin e faqeve për sot. Provo nesër.',
    preview_expired: 'Parapamja skadoi. Rindërtoje falas.',
    has_business: 'Ke tashmë një biznes me këtë numër.',
    subdomain_taken: 'Kjo adresë është e zënë. Provo një tjetër.',
  },

  /* ---- WhatsApp messages (§3.5, exact text) ------------------------------ */
  wa: {
    /** A. Customer → business, after booking */
    customerConfirm: (p: { service: string; date: string; time: string; name: string; link: string }) =>
      `Përshëndetje! Sapo rezervova termin:\n${p.service}, ${p.date}, ora ${p.time}\nEmri: ${p.name}\n${p.link}`,
    /** B. Business → customer, booking added by hand */
    manualConfirm: (p: { name: string; business: string; service: string; date: string; time: string; link: string }) =>
      `Përshëndetje ${p.name}! Termini yt te ${p.business}:\n${p.service}, ${p.date}, ora ${p.time}\nHerën tjetër rezervo vetë këtu: ${p.link}`,
    /** C. Business → customer, reminder ("sot" or "nesër") */
    reminder: (p: { name: string; when: string; time: string; business: string; link: string }) =>
      `Përshëndetje ${p.name}! Të kujtojmë terminin ${p.when} në orën ${p.time} te ${p.business}.\nNëse s'mund të vish, anuloje këtu: ${p.link}\nRezervuar përmes Termini`,
    /** D. Business → customer, cancelled by the business */
    cancelled: (p: { name: string; date: string; time: string; business: string; link: string }) =>
      `Përshëndetje ${p.name}. Na vjen keq, termini yt ${p.date} në orën ${p.time} te ${p.business} u anulua.\nZgjidh një orë tjetër këtu: ${p.link}`,
    /** E. Business → customer, after a no-show */
    noShow: (p: { name: string; time: string; link: string }) =>
      `Përshëndetje ${p.name}. Sot të pritëm në ${p.time} dhe nuk erdhe. Nëse do një termin tjetër: ${p.link}`,
    /** F. Owner shares the link */
    share: (p: { business: string; link: string }) => `Tani mund të rezervosh termin te ${p.business} online, pa thirrur: ${p.link}`,
    fullBusiness: 'Përshëndetje! Dua të rezervoj një termin, por online s\'ka orë të lira.',
    support: 'Përshëndetje, kam një pyetje për Termini.',
    supportPage: (id: string) => `Përshëndetje, kam një pyetje për faqen time (${id}).`,
    cashPage: (ref: string) => `Përshëndetje! Dua ta paguaj faqen me para në dorë. Kodi: ${ref}`,
    previewReady: (link: string) =>
      `E përgatita faqen e biznesit tuaj, shikojeni këtu: ${link}\nNëse ju pëlqen, me 100 € një herë bëhet e juaja, me butonin e rezervimit brenda. Pagesë me transfer bankar, Paysera ose para në dorë.`,
    pageLive: (link: string) => `Faqja jonë është gati: ${link}`,
  },

  /* ---- marketing home ---------------------------------------------------- */
  home: {
    title: 'Termini · Rezervo terminin në 20 sekonda',
    description: 'Rezervime online për berberë, sallone, dentistë dhe klinika në Kosovë. Falas për bizneset.',
    heroTitle: 'Më pak thirrje. Më shumë klientë.',
    heroText: 'Klientët e rezervojnë terminin vetë, në 20 sekonda. Ti e sheh ditën në telefon. Falas.',
    cta: 'Regjistro biznesin tënd falas', find: 'Gjej një termin', login: 'Hyr',
    stepsTitle: 'Gati në 2 minuta',
    steps: [
      { n: '01', title: 'Shkruaj biznesin', text: 'Emri, shërbimet me çmime dhe orari. I kemi mbushur vetë të zakonshmet.' },
      { n: '02', title: 'Merre linkun', text: 'Vendose në bio të Instagramit ose printo QR-kodin te pasqyra.' },
      { n: '03', title: 'Klientët rezervojnë vetë', text: 'Ti e sheh ditën në telefon dhe u dërgon kujtesë në WhatsApp me një prekje.' },
    ],
    customersTitle: 'Rezervo terminin në 20 sekonda.',
    customersText: 'Zgjidh shërbimin, zgjidh orën, shkruaj emrin. Pa llogari, pa thirrje, pa pritje.',
    pageTitle: 'Faqja e biznesit tënd, gati në 2 minuta.',
    pageText: 'Përshkruaje biznesin me dy fjali dhe ngarko disa foto. E sheh faqen para se të paguash.',
    pageCta: 'Shiko si duket',
    foot: 'Bërë në Kosovë.',
  },

  /* ---- login -------------------------------------------------------------- */
  login: {
    title: 'Hyr në Termini', text: 'Shkruaj numrin me të cilin u regjistrove.',
    phone: 'Numri i telefonit', sendCode: 'Dërgo kodin', enter: 'Hyr',
    code: 'Kodi që të erdhi me SMS', codeSent: 'Kodi u dërgua me SMS.', resendQ: "S'të erdhi?", resend: 'Dërgoje përsëri', resent: 'Kodi u dërgua përsëri.',
    devCode: (c: string) => `Kodi yt (vetëm në zhvillim, pa SMS): ${c}`,
    noAccount: "S'ke llogari?", haveAccount: 'Ke llogari?', digit: (n: number) => `Shifra ${n}`,
  },

  /* ---- customer booking (§3.1–3.4) ---------------------------------------- */
  booking: {
    pageTitle: (biz: string) => `${biz} · Rezervo termin`,
    openUntil: (t: string) => `Hapur deri në ${t}`,
    closedOpens: (when: string, t: string) => `Mbyllur · hapet ${when} në ${t}`,
    closedNow: 'Mbyllur',
    callBiz: (biz: string) => `Thirr ${biz}`,
    s1: 'Zgjidh shërbimin', s2: 'Zgjidh orën', s3: 'Kush po vjen?',
    who: 'Te kush', anyStaff: 'Kushdo që është i lirë', day: 'Dita', freeTimes: 'Orët e lira',
    full: 'plot', closedDay: 'mbyllur',
    morning: 'Paradite', afternoon: 'Pasdite', evening: 'Mbrëmje',
    emptyDay: 'Asnjë orë e lirë këtë ditë.', seeDay: (d: string) => `Shiko ${d}`,
    emptyAll: 'Jemi plot për dy javët e ardhshme. Na shkruaj në WhatsApp.', writeWa: 'Shkruaj në WhatsApp',
    noServices: "Ky biznes ende s'ka shtuar shërbime.",
    change: 'Ndrysho', name: 'Emri', namePh: 'Emri dhe mbiemri', phone: 'Numri i telefonit', phonePh: '44 123 456',
    phoneHint: 'Vetëm për konfirmimin dhe kujtesën e terminit.',
    note: (biz: string) => `Shënim për ${biz}`, notePh: 'P.sh. vij me djalin',
    pickTime: 'Zgjidh një orë', confirm: 'Konfirmo terminin', payOnSite: 'Pagesa bëhet në lokal.',
    at: 'ora', notFoundTitle: 'Kjo faqe nuk ekziston.', notFoundText: 'Kontrollo linkun.', searchBiz: 'Kërko një biznes',
  },

  confirmation: {
    pageTitle: (biz: string) => `Termini u rezervua · ${biz}`,
    title: 'Termini u rezervua!',
    text: (dayAcc: string, time: string) => `Të presim ${dayAcc} në ${time}. Dërgoja konfirmimin biznesit në WhatsApp, që ta ketë edhe ai.`,
    cancelledBadge: 'Anuluar', cancelledTitle: 'Termini u anulua',
    cancelledText: (biz: string) => `${biz} u njoftua. Mund të zgjedhësh një orë tjetër kur të duash.`,
    cancelledByBiz: (biz: string) => `${biz} e anuloi këtë termin. Zgjidh një orë tjetër kur të duash.`,
    doneBadge: 'Përfunduar', doneTitle: 'Termini përfundoi', doneText: 'Faleminderit që erdhe. Rezervo herën tjetër me të njëjtin link.',
    noShowBadge: "S'erdhe",
    service: 'Shërbimi', when: 'Kur', where: 'Ku', price: 'Çmimi', payOnSite: '· paguan në lokal',
    sendWa: 'Dërgo konfirmimin në WhatsApp', addCal: 'Shto në kalendar', directions: 'Si të vij',
    rebook: 'Rezervo një orë tjetër', cancel: 'Anulo terminin',
    sureTitle: 'A je i sigurt?',
    sureText: (svc: string, dayAcc: string, dm: string, time: string) => `Termini për ${svc}, ${dayAcc} më ${dm} në ${time}, do të anulohet dhe ora do t'i lirohet dikujt tjetër.`,
    yesCancel: 'Po, anulo', noKeep: 'Jo, mbaje',
  },

  find: {
    pageTitle: 'Gjej një termin · Termini', title: 'Gjej një termin', text: 'Biznese me orë të lira, afër teje.',
    city: 'Qyteti', all: 'Të gjitha', nextFree: 'E lira e radhës', from: 'nga',
    noFree: 'Plot për dy javë', paused: 'Me telefon',
    empty: (city: string) => `Ende s'ka biznese në ${city}.`, emptyAll: "Ende s'ka biznese këtu.", addYours: 'Ke biznes? Shtoje falas.',
  },

  /* ---- onboarding (§4.1) --------------------------------------------------- */
  onboarding: {
    pageTitle: 'Merre linkun tënd · Termini',
    s1: 'Si quhet biznesi yt?', s1Text: 'Dy minuta dhe e ke linkun tënd për rezervime. Falas.',
    bizName: 'Emri i biznesit', bizPh: 'P.sh. Berberi Arti', type: 'Lloji', city: 'Qyteti',
    s2: 'Çfarë ofron?', s2Text: (forWhom: string) => `I kemi shtuar shërbimet e zakonshme për ${forWhom}. Ndrysho çmimet ose fiki ato që s'i bën.`,
    s2TextEmpty: 'Shto shërbimet që ofron, me kohëzgjatje dhe çmim.',
    svcName: 'Emri i shërbimit', duration: 'Kohëzgjatja', price: 'Çmimi', offer: (n: string) => `Ofroj ${n}`,
    addService: 'Shto shërbim', changeLater: "Mund t'i ndryshosh kur të duash.",
    s3: 'Kur punon?', s3Text: 'Klientët shohin vetëm orët brenda këtij orari.',
    copyMonday: 'Kopjo të hënën në të gjitha ditët', copied: 'Orari i së hënës u kopjua në të gjitha ditët e hapura.',
    s3Hint: 'Pauzën e drekës dhe ditët e pushimit i shton më vonë te Cilësimet.',
    s4: 'Numri yt i telefonit', s4Text: 'Me këtë numër hyn në Termini. Klientët ta dërgojnë konfirmimin këtu në WhatsApp.',
    yourName: 'Emri yt', yourNamePh: 'P.sh. Arti', phone: 'Numri i telefonit', phonePh: '49 123 456',
    sendCode: 'Dërgo kodin', openAccount: 'Hap llogarinë',
    doneTitle: 'Gati! Ky është linku yt', doneText: 'Vendose në bio të Instagramit. Kush e hap, rezervon vetë.',
    copyLink: 'Kopjo linkun', shareWa: 'Ndaje në WhatsApp', qr: 'QR-kodi', asCustomer: 'Si e sheh klienti', toCalendar: 'Shko te kalendari',
    from: 'nga', to: 'deri', openLabel: 'hapur',
  },

  /* ---- owner app ------------------------------------------------------------ */
  tabs: { calendar: 'Kalendari', customers: 'Klientët', services: 'Shërbimet', settings: 'Cilësimet', main: 'Kryesore' },

  calendar: {
    pageTitle: (biz: string) => `Kalendari · ${biz}`,
    prevDay: 'Dita e kaluar', nextDay: 'Dita tjetër', dayView: 'Dita', weekView: 'Java',
    summary: (n: number, eur: string) => `${n} ${n === 1 ? 'termin' : 'termine'}${eur ? ' · ' + eur : ''}`,
    came: (n: number) => `${n} ${n === 1 ? 'erdhi' : 'erdhën'}`,
    next: 'I radhës:', inAt: 'në', dayBookings: 'Terminet e ditës', daySummary: 'Përmbledhja e ditës',
    nowBadge: 'Tani', newBadge: 'i ri', noShowBadge: "S'erdhi", noShows: (n: number) => `${n} mosardhje`,
    nowLabel: (t: string) => `Tani, ora ${t}`,
    emptyNew: "Ende s'ke termine.", emptyNewText: 'Ndaje linkun që klientët të rezervojnë vetë.', shareLink: 'Ndaje linkun', addOwn: 'Shto një termin vetë',
    freeDay: 'Asnjë termin sot.', freeOtherDay: 'Asnjë termin këtë ditë.', closedDay: 'Sot nuk punon.', closedOtherDay: 'Këtë ditë nuk punon.', dayOff: 'Ditë pushimi.',
    checklist: 'Për të filluar',
    check1: 'Vendose linkun në bio të Instagramit', check2: 'Shto terminin e parë', check2Meta: 'Edhe ato që i merr me telefon',
    check3: 'Shto një foto të lokalit', check3Meta: 'Klientët të njohin më lehtë',
    fab: 'Termin',
    // booking sheet
    firstVisit: 'Vizita e parë', visits: (n: number) => `${n} ${n === 1 ? 'vizitë' : 'vizita'}`, walkIn: 'Pa numër',
    service: 'Shërbimi', time: 'Ora', price: 'Çmimi', phone: 'Telefoni', note: 'Shënim',
    remind: 'Dërgo kujtesë', sendConfirm: 'Dërgo konfirmimin', came1: 'Erdhi', noShow1: "S'erdhi", move: 'Zhvendos', cancel: 'Anulo terminin',
    markedCame: (n: string) => `${n} u shënua: erdhi.`, markedNoShow: (n: string) => `${n} u shënua: s'erdhi.`,
    cancelled: 'Termini u anulua.', tellCustomer: 'Njofto në WhatsApp', moved: 'Termini u zhvendos.', restored: 'U kthye si më parë.',
    callName: (n: string) => `Thirr ${n}`, statusDone: 'Erdhi', statusCancelled: 'Anuluar',
    moveTitle: 'Zhvendos terminin', moveSave: 'Zhvendose',
    // new booking sheet
    newTitle: 'Termin i ri', day: 'Dita', clientName: 'Emri i klientit', clientNamePh: 'Shkruaj emrin',
    clientPhone: 'Telefoni', clientPhoneHint: "Me numër, mund t'ia dërgosh konfirmimin në WhatsApp.",
    saveBooking: 'Ruaj terminin', saveAnyway: 'Ruaje gjithsesi', bookingSaved: 'Termini u ruajt.', sendWa: 'Dërgo në WhatsApp',
    blockTime: 'Blloko këtë orë', blockTitle: 'Orë e bllokuar', blockName: 'E bllokuar', blockUntil: 'Deri në', blockReason: 'Arsyeja', blockReasonPh: 'P.sh. Pauzë, punë personale',
    blockSave: 'Blloko', blocked: 'Ora u bllokua.', unblock: 'Hiqe bllokimin', unblocked: 'Bllokimi u hoq.',
    weekEmpty: 'Asnjë termin këtë javë.',
  },

  customers: {
    pageTitle: (biz: string) => `Klientët · ${biz}`, title: 'Klientët', search: 'Kërko me emër ose numër',
    empty: 'Klientët shfaqen këtu pas terminit të parë.', noResults: 'Asnjë klient me këtë emër ose numër.',
    lastVisit: (d: string) => `Vizita e fundit: ${d}`, noVisit: 'Ende pa vizitë',
    history: 'Historia', note: 'Shënim', notePh: 'P.sh. alergji, stili i preferuar', block: 'Blloko numrin', unblock: 'Zhblloko numrin',
    blockedBadge: 'i bllokuar', blockedToast: "Numri u bllokua. S'mund të rezervojë më online.", blockedCancelled: (n: number) => `Numri u bllokua dhe ${n === 1 ? '1 termin i tij u anulua' : `${n} terminet e tij u anuluan`}.`, unblockedToast: 'Numri u zhbllokua.',
    upcoming: 'I ardhshëm',
  },

  services: {
    pageTitle: (biz: string) => `Shërbimet · ${biz}`, title: 'Shërbimet', add: 'Shto',
    intro: 'Kështu i sheh klienti kur rezervon.', seePage: 'Shiko faqen',
    moveUp: (n: string) => `Ngrije ${n}`, moveDown: (n: string) => `Ule ${n}`, bookable: (n: string) => `${n}, e rezervueshme`,
    offHint: "Të fikurat s'shfaqen për rezervime të reja. Terminet e marra mbeten.",
    emptyTitle: "Ende s'ke shërbime.", emptyText: 'Shto të parin që klientët të mund të rezervojnë.', addService: 'Shto shërbim',
    newTitle: 'Shërbim i ri', name: 'Emri', namePh: 'P.sh. Qethje', howLong: 'Sa zgjat',
    durations: [[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 orë'], [90, '1 orë 30']] as [number, string][],
    customMin: 'Kohëzgjatja në minuta',
    price: 'Çmimi', priceIf: '(nëse do ta tregosh)', priceHint: 'Bosh = klienti sheh "Çmimi në lokal".',
    priceFrom: (p: string) => `Çmimi fillon nga kjo shumë ("nga ${p || '5'} €")`,
    desc: 'Përshkrimi', descPh: 'P.sh. Me brisk dhe peshqir të nxehtë',
    delete: 'Fshije shërbimin', deleteTitle: 'Ta fshijmë këtë shërbim?',
    deleteWith: (n: number) => `Ky shërbim ka ${n} ${n === 1 ? 'termin të ardhshëm' : 'termine të ardhshme'}. Ato mbeten; shërbimi nuk shfaqet më për rezervime të reja.`,
    deleteWithout: 'Shërbimi nuk do të shfaqet më te linku yt.',
    yesDelete: 'Po, fshije', noKeep: 'Jo, mbaje', deleted: 'Shërbimi u fshi.', savedOne: 'Shërbimi u ruajt.',
    turnedOn: 'Klientët mund ta rezervojnë përsëri.', turnedOff: "U fik. S'shfaqet më për rezervime të reja.",
  },

  settings: {
    pageTitle: (biz: string) => `Cilësimet · ${biz}`, title: 'Cilësimet', backToSettings: 'Kthehu te Cilësimet',
    yourLink: 'Linku yt për rezervime', copy: 'Kopjo', qr: 'QR-kodi', share: 'Ndaje', myLink: 'Linku im',
    online: 'Rezervimet online', onlineOn: 'Klientët rezervojnë vetë nga linku', onlineOff: 'Të ndalura. Linku tregon numrin tënd.',
    onlineOpened: 'Rezervimet online u hapën.', onlineStopped: 'Rezervimet online u ndalën.',
    groupBookings: 'Rezervimet', hours: 'Orari', daysOff: 'Ditë pushimi', nextOff: (d: string) => `E ardhshmja: ${d}`, noOff: 'Asnjë e planifikuar',
    rules: 'Rregullat e rezervimit', rulesMeta: (days: number, cut: string) => `${days} ditë përpara · anulim ${cut} para`,
    hoursMeta: (days: string, t: string) => `${days} · nga ora ${t}`, hoursNone: 'Pa orar',
    groupBiz: 'Biznesi', profile: 'Profili', profileMeta: 'Emri, fotoja, adresa, Instagrami',
    staff: 'Stafi', staffMeta: 'Disa punonjës, secili me kalendar',
    bannerTitle: 'Bëje faqen e biznesit tënd', bannerText: 'Gati në 2 minuta. E sheh para pagesës.',
    bannerLive: 'Faqja jote është live', bannerPreview: 'Faqja jote të pret', bannerPreviewText: 'Shikoje parapamjen dhe merre.',
    groupAccount: 'Llogaria', writeUs: 'Na shkruaj në WhatsApp', writeUsMeta: 'Për ndihmë, përgjigjemi brenda ditës',
    logout: 'Dil nga llogaria', deleteAccount: 'Fshije llogarinë', admin: 'Paneli i adminit',
    logoutTitle: 'Të dalësh nga llogaria?', logoutText: (p: string) => `Linku yt vazhdon të punojë. Për të hyrë përsëri të duhet numri ${p}.`,
    yesLogout: 'Po, dil', noStay: 'Jo, qëndro',
    deleteTitle: 'Ta fshijmë llogarinë?', deleteText: "Fshihen linku, terminet dhe lista e klientëve. Kjo s'kthehet mbrapsht.",
    deleteConfirm: 'Për ta konfirmuar, shkruaj FSHIJE', deleteWord: 'FSHIJE', deleteForever: 'Fshije përgjithmonë', noKeep: 'Jo, mbaje',
    // orari
    weekHours: 'Orari i javës', pause: 'Pauza', everyDay: 'Çdo ditë', noPause: 'Pa pauzë', pauseHint: "Gjatë pauzës klientët s'mund të rezervojnë.",
    pauseLabel: 'Pauzë dreke çdo ditë pune', pauseFrom: 'Pauza, nga', pauseTo: 'Pauza, deri',
    suggest: 'Festat që vijnë. Prek për ta mbyllur atë ditë:', addDayOff: 'Shto ditë pushimi', dayOffTitle: 'Ditë pushimi',
    from: 'Nga', to: 'Deri', oneDayHint: 'Për një ditë të vetme, lëri të dyja njësoj.',
    reason: 'Arsyeja', reasonOnlyYou: '(e sheh vetëm ti)', reasonPh: 'P.sh. Pushime, dasmë, festë', closeDay: 'Mbylle këtë ditë',
    dayClosed: 'Dita u mbyll për rezervime.', dayAdded: 'U shtua te ditët e pushimit.', dayRemoved: 'Dita u hoq. Je përsëri hapur.',
    remove: (d: string) => `Hiqe ${d}`, nDays: (n: number) => `${n} ditë`, seeDay: 'Shiko ditën',
    // rules
    r1: 'Sa përpara mund të rezervohet', r2: 'Sa para orës mund të rezervohet', r2Hint: 'Që askush të mos vijë pa e ditur ti më parë.',
    r3: 'Klienti mund ta anulojë deri', r3Hint: 'Më vonë se kaq, duhet të të thërrasë.', r3After: 'para terminit',
    r4: 'Orët ofrohen çdo', r4Hint: 'Me 15 min klienti sheh 09:00, 09:15, 09:30…',
    days: (n: number) => `${n} ditë`,
    listed: 'Shfaqu te "Gjej një termin"', listedMeta: 'Klientë të rinj të gjejnë sipas qytetit',
    // profile
    changePhoto: 'Ndrysho foton', photoHint: 'Logoja ose një foto e lokalit.', photoSaved: 'Fotoja u ruajt.',
    bizName: 'Emri i biznesit', description: 'Përshkrimi', descPh: 'Një fjali për biznesin tënd',
    publicPhone: 'Telefoni që shohin klientët', publicPhoneHint: 'Këtu të vijnë edhe konfirmimet në WhatsApp.',
    city: 'Qyteti', address: 'Adresa', addressHint: 'Shto diçka që njihet: "te Çarshia", "përballë postës".',
    pinHere: 'Jam në lokal, vendose në hartë', pinSaved: 'Lokacioni u ruajt nga telefoni yt.', pinFailed: "S'e morëm dot lokacionin. Lejoje në telefon dhe provo përsëri.",
    instagram: 'Instagrami',
  },

  durationsShort: { 30: '30 min', 60: '1 orë', 120: '2 orë', 360: '6 orë', 1440: '1 ditë' } as Record<number, string>,

  /* ---- Faqja Gati (§6) ----------------------------------------------------- */
  fg: {
    pageTitle: 'Faqja Gati · Faqja e biznesit tënd, gati në 2 minuta',
    description: 'Përshkruaje biznesin, ngarko disa foto dhe shihe faqen gati. Paguan vetëm nëse të pëlqen.',
    by: 'nga', heroTitle: 'Faqja e biznesit tënd, gati në 2 minuta.',
    heroText: 'Shkruaj dy fjali për biznesin dhe ngarko disa foto. Ne e ndërtojmë faqen, ti e sheh para se të paguash.',
    start: 'Fillo falas', seeFirst: 'E sheh faqen para se të paguash.',
    examples: 'Shembuj', examplesText: 'Prek njërën për ta parë të plotë.', openExample: (n: string) => `Hap shembullin: ${n}`,
    how: 'Si funksionon',
    howSteps: [
      { n: '01', title: 'Trego për biznesin', text: 'Çfarë bën, sa kushton, kur je hapur dhe numri i telefonit.' },
      { n: '02', title: 'Shihe faqen', text: 'Brenda dy minutash e sheh faqen e plotë, me fotot e tua.' },
      { n: '03', title: 'Merre për 100 €', text: 'Paguan një herë. Faqja del live me butonin "Rezervo termin".' },
    ],
    includesTitle: 'Paguan një herë. Faqja është e jotja.',
    includes: [
      'Faqja live pa watermark, me butonat që punojnë',
      'Adresa emri.faqjagati.com falas, ose domeni yt (15 €/vit)',
      'Fotot e tua të përmirësuara',
      'Butoni "Rezervo termin" i lidhur me Termini',
      'Hosting pa pagesë mujore',
      'Ndryshimet: 1 falas në 30 ditët e para, pastaj 20 € secili (ose 5 €/muaj pa limit)',
    ],
    templates: {
      berber: 'Berber', 'klinike-dentare': 'Klinikë dentare', 'restorant-kafe': 'Restorant / kafe',
      bujtine: 'Bujtinë', 'salon-bukurie': 'Sallon bukurie', dyqan: 'Dyqan',
      'sallon-dasmash': 'Sallon dasmash', autoshkolla: 'Autoshkollë', 'lavazh-servis': 'Lavazh / servis', auto: 'Tjetër',
    } as Record<string, string>,
    // wizard
    w1: 'Çfarë biznesi ke?', w1Text: 'Zgjidh llojin. Secili ka stilin e vet.',
    name: 'Emri i biznesit', namePh: 'P.sh. Berberi Arti', city: 'Qyteti',
    w2: 'Tregona për biznesin', w2Text: 'Shkruaj si t\'ia tregoje një klienti: çfarë ofron, çmimet, orari, adresa, telefoni.',
    about: 'Përshkrimi',
    placeholders: {
      berber: 'Berber në Gjakovë, te Çarshia e Madhe. Qethje 5 €, mjekër 3 €. Hapur 9–20, të dielën mbyllur. 049 123 456. Punojmë që nga 2015.',
      'klinike-dentare': 'Klinikë dentare në Prishtinë, Rr. Fehmi Agani 24. Kontroll 10 €, pastrim 25 €, mbushje nga 20 €. Hapur 9–19, të shtunën 9–14. 044 123 456.',
      'restorant-kafe': 'Restorant tradicional në Prizren, te Shadërvani. Tavë Prizreni 6 €, flija 5 €, qebapa 4 €. Hapur 8–23 çdo ditë. 049 123 456. Që nga 1998.',
      bujtine: 'Bujtinë në Rugovë, fshati Drelaj. Dhomë dyshe 45 € nata me mëngjes, kasolle 70 €. 8 dhoma. Hapur gjithë vitin. 049 123 456.',
      'salon-bukurie': 'Sallon bukurie në Prishtinë, Rr. Rexhep Luci 5. Fenirim 8 €, ngjyrosje nga 30 €, manikyr 10 €. Hapur 9–20, të dielën mbyllur. 044 123 456.',
      dyqan: 'Dyqan lulesh në Ferizaj, Rr. Dëshmorët e Kombit 41. Buqetë nga 15 €, bimë nga 8 €. Dërgesë brenda 60 minutave. Hapur 8–20. 049 123 456.',
      'sallon-dasmash': 'Sallon dasmash në Gjakovë, Rr. Tirana. Salla e madhe deri në 600 mysafirë, salla e vogël deri në 200. Meny klasike 25 € për person, meny e plotë 32 € për person. Parking për 300 vetura. Vizita në sallë 10–18. 049 123 456. Që nga 2006.',
      autoshkolla: 'Autoshkollë në Prishtinë, Rr. Enver Maloku 18. Kategoria B 320 €, kategoria A 220 €, kategoria C 480 €, orë shtesë 12 €. 6 instruktorë. Hapur 8–19, të shtunën 9–15. 044 123 456. Që nga 2009.',
      'lavazh-servis': 'Lavazh dhe servis në Ferizaj, Rr. Rexhep Bislimi. Larje e shpejtë 5 €, larje e plotë 10 €, ndërrim vaji nga 45 €, ndërrim i gomave 20 €, diagnostikë 15 €. 4 kanale. Hapur 8–20 çdo ditë. 045 123 456. Që nga 2016.',
      auto: 'Çfarë bën, ku je, sa kushton, kur je hapur dhe numri i telefonit.',
    } as Record<string, string>,
    oldUrl: 'Ke faqe të vjetër? Ngjite linkun', oldUrlPh: 'https://',
    oldUrlHint: 'Linqet e Instagramit dhe Facebookut nuk lexohen. Ngarko fotot më poshtë.',
    aboutError: 'Shkruaj të paktën dy fjali për biznesin.',
    w3: 'Fotot', w3Text: 'Ngarko deri në 10 foto. E para bëhet fotoja kryesore.',
    tips: 'Dritë dite, pa tekst mbi foto, një foto e lokalit nga jashtë.',
    addPhotos: 'Shto foto', photoN: (n: number) => `Foto ${n}`, removePhoto: (n: number) => `Hiqe foton ${n}`, makeFirst: 'Bëje kryesoren', mainPhoto: 'Kryesorja',
    contactPhone: 'Numri yt i telefonit', contactHint: 'Të shkruajmë vetëm për faqen tënde.',
    build: 'Ndërto faqen', buildNoPhotos: 'Vazhdo pa foto', uploading: (a: number, b: number) => `Po ngarkohen fotot ${a}/${b}`,
    // progress
    building: 'Po e ndërtojmë', buildingText: 'Zgjat 1 deri në 3 minuta. Mund ta mbash hapur këtë faqe ose të kthehesh më vonë te ky link.',
    stages: { read: 'Po lexojmë përshkrimin', write: 'Po shkruajmë tekstet', photos: 'Po rregullojmë fotot', build: 'Po e montojmë faqen' } as Record<string, string>,
    failed: 'Diçka shkoi keq. Po e provojmë përsëri.', failedFinal: "S'e ndërtuam dot faqen. Na shkruaj në WhatsApp dhe e rregullojmë bashkë.", retry: 'Provo përsëri',
    oldUrlFailed: "S'e lexuam dot faqen e vjetër. Vazhduam me përshkrimin tënd.",
    // preview
    previewTitle: (n: string) => `Parapamja · ${n}`,
    yours: 'Kjo është faqja jote.', buy: (p: string) => `Merre për ${p}`,
    changeSomething: 'Ndrysho diçka', tryStyle: 'Provo stil tjetër', styleN: (n: number) => `Stili ${n}`, styleChanged: 'Stili u ndryshua.',
    changeTitle: 'Çfarë të ndryshojmë?', changeText: (left: number) => `Ke edhe ${left} ${left === 1 ? 'ndryshim' : 'ndryshime'} falas.`,
    changeNote: 'Çfarë të ndryshojmë', changeNotePh: 'P.sh. Shto që kemi parking. Hiqe çmimin e mjekrës.',
    changeAbout: 'Përshkrimi yt', rebuild: 'Rindërtoje',
    expiredTitle: 'Parapamja skadoi.', expiredText: 'Rindërtoje falas dhe shihe përsëri.',
    previewFrame: 'Parapamja e faqes',
    // payment
    payTitle: 'Merre faqen', payIncludes: 'Çfarë merr',
    address: 'Adresa e faqes', addressFree: 'Falas', addressOwn: 'Domeni yt', addressOwnPrice: '+15 €/vit', ownPh: 'p.sh. berberiarti.com',
    ownHint: 'Na trego domenin që do. E regjistrojmë ne dhe ta lidhim me faqen.',
    methods: 'Si do të paguash?',
    paysera: 'Paysera', payseraMeta: 'Me kartë ose nga banka jote', payseraSoon: 'Së shpejti. Tani për tani zgjidh transfer ose para në dorë.',
    bank: 'Transfer bankar', bankMeta: 'Nga e-banking ose në sportel',
    cash: 'Para në dorë', cashMeta: 'Na shkruaj në WhatsApp, vijmë te ti',
    total: 'Gjithsej', once: 'një herë', perYear: 'në vit',
    goPay: 'Vazhdo te pagesa', pickMethod: 'Zgjidh mënyrën e pagesës',
    bankTitle: 'Të dhënat për transfer', iban: 'IBAN', holder: 'Përfituesi', bankName: 'Banka', amount: 'Shuma', reference: 'Përshkrimi i pagesës',
    bankHint: 'Shkruaje këtë kod te përshkrimi i pagesës, që ta njohim transferin tënd.',
    iPaid: 'E kreva pagesën', copied: 'U kopjua.',
    pendingTitle: 'Po e presim pagesën', pendingText: 'Sapo ta shohim pagesën, faqja del live dhe të shkruajmë në WhatsApp. Zakonisht brenda ditës.',
    pendingCash: 'Na shkruaj në WhatsApp dhe merremi vesh kur të vijmë.', writeUs: 'Na shkruaj në WhatsApp', changeMethod: 'Ndrysho mënyrën e pagesës',
    trust: (name: string) => `Pagesën e pranon ${name}. Për çdo pyetje na shkruaj në WhatsApp.`,
    // live
    liveTitle: 'Faqja jote është live!', liveText: 'Ndaje me klientët dhe vendose në bio të Instagramit.',
    openPage: 'Hape faqen', copyLink: 'Kopjo linkun', shareWa: 'Ndaje në WhatsApp', putInBio: 'Vendose në Instagram bio',
    terminiOn: 'Butoni "Rezervo termin" është i lidhur me Termini.', terminiOff: 'Aktivizo rezervimet online falas',
    terminiOffText: 'Klientët rezervojnë vetë nga faqja jote. Dy minuta, pa pagesë.',
    unpublished: 'Faqja është paguar dhe po përgatitet për publikim.',
    notFoundTitle: 'Kjo faqe nuk ekziston.', notFoundText: 'Kontrollo linkun ose ndërto një faqe të re.',
  },

  /* ---- admin ------------------------------------------------------------------ */
  admin: {
    pageTitle: 'Admin · Termini', title: 'Admin', pages: 'Faqet', businesses: 'Bizneset',
    all: 'Të gjitha', status: {
      draft: 'Draft', generating: 'Në ndërtim', preview: 'Parapamje', payment_pending: 'Pret pagesën', paid: 'Paguar',
      live: 'Live', failed: 'Dështoi', expired: 'Skaduar',
    } as Record<string, string>,
    noPages: "Ende s'ka faqe.", noBusinesses: "Ende s'ka biznese.",
    contact: 'Kontakti', created: 'Krijuar', payment: 'Pagesa', noPayment: 'Pa pagesë',
    method: { paysera: 'Paysera', bank: 'Transfer', cash: 'Para në dorë' } as Record<string, string>,
    markPaid: 'Shëno të paguar', markPaidTitle: 'Shëno të paguar', markPaidText: 'Faqja del live menjëherë dhe watermark-u hiqet.',
    methodLabel: 'Mënyra e pagesës', note: 'Shënim', notePh: 'P.sh. Mori Roni, 14 nëntor', confirmPaid: 'Po, u pagua',
    paidToast: 'U shënua e paguar. Faqja është live.', unpublish: 'Hiqe nga publikimi', unpublished: 'Faqja u hoq nga publikimi.', publish: 'Publikoje',
    openPreview: 'Parapamja', openLive: 'Faqja live', sendPreview: 'Dërgo parapamjen', details: 'Detajet',
    content: 'Përmbajtja (JSON)', contentHint: 'Ndryshimet kontrollohen sipas skemës para se të ruhen.', contentSaved: 'Përmbajtja u ruajt.',
    photos: 'Fotot', replace: 'Zëvendëso', replaced: 'Fotoja u zëvendësua.', noPhotos: 'Pa foto të ngarkuara.',
    generations: 'Gjenerimet', input: 'Çfarë shkroi pronari',
    bookingsWeek: (n: number) => `${n} termine këtë javë`, bookingsTotal: (n: number) => `${n} gjithsej`,
    onlyAdmin: 'Kjo faqe është vetëm për adminin.', loginAsAdmin: 'Hyr me numrin e adminit',
    back: 'Kthehu te lista',
    locked: 'Paneli i adminit është i kyçur. Shkruaj fjalëkalimin e adminit.',
    unlockTitle: 'Fjalëkalimi i adminit', unlockText: 'Hapi i dytë i sigurisë. Paneli hapet për 8 orë në këtë pajisje.',
    password: 'Fjalëkalimi', unlock: 'Hape panelin', wrongPassword: 'Fjalëkalimi nuk është i saktë.',
    tooManyTries: 'Shumë tentime. Provo përsëri pas 15 minutash.',
    notSet: 'Fjalëkalimi i adminit nuk është vendosur ende në server (ADMIN_PASSWORD_HASH).',
  },
};

export type Sq = typeof sq;
