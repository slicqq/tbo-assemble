"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Locale = "en" | "hi";

const translations: Record<string, Record<Locale, string>> = {
  // Microsite
  "youre_invited": { en: "You're Invited", hi: "आप आमंत्रित हैं" },
  "book_your_stay": { en: "Book Your Stay", hi: "अपना कमरा बुक करें" },
  "reserve_now": { en: "Reserve Now", hi: "अभी बुक करें" },
  "rooms_available": { en: "Rooms Available", hi: "कमरे उपलब्ध" },
  "guests_confirmed": { en: "Guests Confirmed", hi: "अतिथि पुष्टि" },
  "included_perks": { en: "Included Perks", hi: "शामिल सुविधाएँ" },
  "choose_your_room": { en: "Choose Your Room", hi: "अपना कमरा चुनें" },
  "select_room": { en: "Select Room", hi: "कमरा चुनें" },
  "per_night": { en: "per night", hi: "प्रति रात" },
  "available": { en: "available", hi: "उपलब्ध" },
  "booked": { en: "booked", hi: "बुक हो चुके" },
  "sold_out": { en: "Sold Out", hi: "बिक चुका" },
  "left": { en: "left", hi: "शेष" },
  "perks_experiences": { en: "Perks & Experiences", hi: "सुविधाएँ और अनुभव" },
  "enhance_stay": { en: "Enhance your stay with these curated offerings", hi: "इन विशेष सुविधाओं के साथ अपने ठहराव को बेहतर बनाएँ" },
  "included": { en: "Included", hi: "शामिल" },
  "ready_to_join": { en: "Ready to Join Us?", hi: "हमसे जुड़ने के लिए तैयार?" },
  "secure_your_spot": { en: "Secure your spot", hi: "अपनी जगह सुनिश्चित करें" },
  "limited_rooms": { en: "Limited rooms available.", hi: "सीमित कमरे उपलब्ध हैं।" },
  "book_room_now": { en: "Book Your Room Now", hi: "अभी कमरा बुक करें" },
  "event_starts_in": { en: "Event Starts In", hi: "कार्यक्रम शुरू होने में" },
  "scroll": { en: "Scroll", hi: "नीचे देखें" },
  "event_concluded": { en: "This event has concluded. Bookings are no longer available.", hi: "यह कार्यक्रम समाप्त हो गया है। बुकिंग अब उपलब्ध नहीं है।" },
  "event_happening": { en: "Event is happening now! Check in at the venue.", hi: "कार्यक्रम अभी चल रहा है! स्थल पर चेक-इन करें।" },
  "group_discounts": { en: "Group Discounts", hi: "सामूहिक छूट" },
  "group_discount_desc": { en: "Book more rooms and save more — exclusive group rates for this event", hi: "ज़्यादा कमरे बुक करें, ज़्यादा बचत पाएँ — इस कार्यक्रम के लिए विशेष सामूहिक दरें" },
  "best_value": { en: "BEST VALUE", hi: "सर्वोत्तम" },
  "discount": { en: "Discount", hi: "छूट" },
  "book_rooms": { en: "Book", hi: "बुक करें" },
  "rooms": { en: "rooms", hi: "कमरे" },
  "booking_deadlines": { en: "Booking Deadlines", hi: "बुकिंग की अंतिम तिथियाँ" },
  "book_before_dates": { en: "Book before these dates to avoid penalties", hi: "जुर्माने से बचने के लिए इन तिथियों से पहले बुक करें" },
  "deadline_passed": { en: "Deadline passed", hi: "समय सीमा बीत गई" },
  "days_remaining": { en: "days remaining", hi: "दिन शेष" },
  "release": { en: "Release", hi: "रिलीज़" },
  "the_os_for_group_travel": { en: "The Operating System for Group Travel", hi: "ग्रुप ट्रैवल के लिए ऑपरेटिंग सिस्टम" },
  "powered_by": { en: "Powered by TBO.com", hi: "TBO.com द्वारा संचालित" },
  // Countdown
  "days": { en: "Days", hi: "दिन" },
  "hours": { en: "Hours", hi: "घंटे" },
  "minutes": { en: "Minutes", hi: "मिनट" },
  "seconds": { en: "Seconds", hi: "सेकंड" },
  "event_started": { en: "Event has started!", hi: "कार्यक्रम शुरू हो गया!" },
  // Room details
  "floor": { en: "Floor", hi: "मंज़िल" },
  "wing": { en: "Wing", hi: "विंग" },
  "standard_accommodation": { en: "Standard accommodation", hi: "मानक आवास" },
  "of": { en: "of", hi: "में से" },
  "from_price": { en: "From", hi: "शुरू" },
  // Bottom nav
  "feedback": { en: "Feedback", hi: "प्रतिक्रिया" },
  "reserve_room": { en: "Reserve Room", hi: "कमरा बुक करें" },
  // Social proof
  "guests_confirmed_count": { en: "guests have already confirmed", hi: "अतिथियों ने पुष्टि की है" },
  "rooms_filling_fast": { en: "Rooms are filling up fast!", hi: "कमरे तेज़ी से भर रहे हैं!" },
  "special_group_rates": { en: "Special group rates applied", hi: "विशेष सामूहिक दरें लागू" },
  // Booking page
  "select_accommodation": { en: "Select your preferred accommodation for the event", hi: "कार्यक्रम के लिए अपना पसंदीदा आवास चुनें" },
  // Booking Form
  "guest_details": { en: "Guest Details", hi: "अतिथि विवरण" },
  "full_name": { en: "Full Name", hi: "पूरा नाम" },
  "email_address": { en: "Email Address", hi: "ईमेल पता" },
  "phone_number": { en: "Phone Number", hi: "फ़ोन नंबर" },
  "group_affiliation": { en: "Group / Affiliation", hi: "समूह / संबद्धता" },
  "special_requests": { en: "Special Requests", hi: "विशेष अनुरोध" },
  "select_add_ons": { en: "Select Add-ons", hi: "अतिरिक्त सेवाएं चुनें" },
  "review_booking": { en: "Review Booking", hi: "बुकिंग की समीक्षा" },
  "confirm_booking": { en: "Confirm Booking", hi: "बुकिंग की पुष्टि करें" },
  "booking_summary": { en: "Booking Summary", hi: "बुकिंग सारांश" },
  "total_amount": { en: "Total Amount", hi: "कुल राशि" },
  "included_free": { en: "Included Free", hi: "मुफ्त शामिल" },
  "nights": { en: "nights", hi: "रातें" },
  "room_rate": { en: "Room Rate", hi: "कमरे का किराया" },
  "step": { en: "Step", hi: "चरण" },
  "next": { en: "Next", hi: "अगला" },
  "back": { en: "Back", hi: "पीछे" },
  "processing": { en: "Processing...", hi: "प्रोसेसिंग..." },
  // Self-Service Portal
  "your_booking": { en: "Your Booking", hi: "आपकी बुकिंग" },
  "booking_details": { en: "Booking Details", hi: "बुकिंग विवरण" },
  "cost_breakdown": { en: "Cost Breakdown", hi: "लागत विवरण" },
  "cancel_booking": { en: "Cancel Booking", hi: "बुकिंग रद्द करें" },
  "booking_confirmed": { en: "Booking Confirmed", hi: "बुकिंग की पुष्टि" },
  "booking_cancelled": { en: "Booking Cancelled", hi: "बुकिंग रद्द" },
  "booking_not_found": { en: "Booking Not Found", hi: "बुकिंग नहीं मिली" },
  "view_invoice": { en: "View Invoice", hi: "चालान देखें" },
  "download_qr": { en: "Download QR Code", hi: "QR कोड डाउनलोड करें" },
  "checked_in": { en: "Checked In", hi: "चेक-इन हो गया" },
  "upgrade_room": { en: "Upgrade Room", hi: "कमरा अपग्रेड करें" },
  // Invoice
  "tax_invoice": { en: "TAX INVOICE", hi: "कर चालान" },
  "bill_to": { en: "Bill To", hi: "बिल प्राप्तकर्ता" },
  "event_details": { en: "Event Details", hi: "कार्यक्रम विवरण" },
  "invoice_number": { en: "Invoice Number", hi: "चालान संख्या" },
  "invoice_date": { en: "Invoice Date", hi: "चालान तिथि" },
  "description": { en: "Description", hi: "विवरण" },
  "quantity": { en: "Qty", hi: "मात्रा" },
  "unit_price": { en: "Unit Price", hi: "इकाई मूल्य" },
  "amount": { en: "Amount", hi: "राशि" },
  "subtotal": { en: "Subtotal", hi: "उप-कुल" },
  "gst": { en: "GST (18%)", hi: "जीएसटी (18%)" },
  "grand_total": { en: "Grand Total", hi: "कुल योग" },
  "terms_conditions": { en: "Terms & Conditions", hi: "नियम और शर्तें" },
  "room_accommodation": { en: "Room Accommodation", hi: "कमरे का आवास" },
  "add_on_services": { en: "Add-on Services", hi: "अतिरिक्त सेवाएं" },
  "free": { en: "Free", hi: "मुफ्त" },
  "paid": { en: "Paid", hi: "भुगतान किया" },
  "print_invoice": { en: "Print Invoice", hi: "चालान प्रिंट करें" },
  // Feedback
  "share_experience": { en: "Share Your Experience", hi: "अपना अनुभव साझा करें" },
  "your_name": { en: "Your Name", hi: "आपका नाम" },
  "your_email": { en: "Your Email", hi: "आपका ईमेल" },
  "rating": { en: "Rating", hi: "रेटिंग" },
  "comments": { en: "Comments", hi: "टिप्पणियाँ" },
  "submit_feedback": { en: "Submit Feedback", hi: "प्रतिक्रिया भेजें" },
  "thank_you_feedback": { en: "Thank you for your feedback!", hi: "आपकी प्रतिक्रिया के लिए धन्यवाद!" },
  // Booking Success
  "booking_success": { en: "You're All Set!", hi: "सब तैयार है!" },
  "group_discount_applied": { en: "Group Discount Applied", hi: "समूह छूट लागू" },
  "email_confirmation": { en: "Email confirmation sent", hi: "ईमेल पुष्टि भेजी गई" },
  "manage_booking": { en: "Manage Your Booking", hi: "अपनी बुकिंग प्रबंधित करें" },
  "book_another": { en: "Book Another Room", hi: "एक और कमरा बुक करें" },
  // Error Messages
  "error_occurred": { en: "An error occurred", hi: "एक त्रुटि हुई" },
  "try_again": { en: "Try Again", hi: "पुनः प्रयास करें" },
  "room_not_available": { en: "This room is no longer available", hi: "यह कमरा अब उपलब्ध नहीं है" },
  "required_field": { en: "This field is required", hi: "यह फ़ील्ड आवश्यक है" },
  "invalid_email": { en: "Please enter a valid email", hi: "कृपया एक वैध ईमेल दर्ज करें" },
  // Itinerary
  "event_schedule": { en: "Event Schedule", hi: "कार्यक्रम अनुसूची" },
  "what_to_expect": { en: "What to expect during the event", hi: "कार्यक्रम के दौरान क्या उम्मीद करें" },
  "arrival_day": { en: "Arrival Day", hi: "आगमन का दिन" },
  "departure_day": { en: "Departure Day", hi: "विदाई का दिन" },
  // Urgency
  "rooms_left_fast": { en: "rooms left — filling fast!", hi: "कमरे शेष — तेज़ी से भर रहे हैं!" },
  "only": { en: "Only", hi: "केवल" },
  "starting_from": { en: "Starting from", hi: "शुरुआत" },
  "up_to": { en: "up to", hi: "अधिकतम" },
  "off": { en: "off", hi: "छूट" },
  // Upgrade (self-service)
  "current_room": { en: "Current Room", hi: "वर्तमान कमरा" },
  "no_upgrades": { en: "No other rooms available", hi: "कोई अन्य कमरा उपलब्ध नहीं" },
  // Demo
  "live_demo": { en: "Live Demo Mode", hi: "लाइव डेमो मोड" },
  "revenue_at_risk": { en: "Revenue At Risk", hi: "जोखिम में राजस्व" },
  // Event Types
  "type_wedding": { en: "Wedding", hi: "शादी" },
  "type_conference": { en: "Conference", hi: "सम्मेलन" },
  "type_corporate": { en: "Corporate", hi: "कॉर्पोरेट" },
  "type_social": { en: "Social Event", hi: "सामाजिक कार्यक्रम" },
  // Guest Status
  "status_confirmed": { en: "Confirmed", hi: "पुष्टि हो गई" },
  "status_invited": { en: "Invited", hi: "आमंत्रित" },
  "status_cancelled": { en: "Cancelled", hi: "रद्द" },
  "status_checked_in": { en: "Checked In", hi: "चेक-इन" },
  // Microsite extras
  "venue_details": { en: "Venue Details", hi: "स्थल विवरण" },
  "check_in_date": { en: "Check-in Date", hi: "चेक-इन तारीख़" },
  "check_out_date": { en: "Check-out Date", hi: "चेक-आउट तारीख़" },
  "total_nights": { en: "Total Nights", hi: "कुल रातें" },
  "contact_organizer": { en: "Contact Organizer", hi: "आयोजक से संपर्क करें" },
  "view_all_rooms": { en: "View All Rooms", hi: "सभी कमरे देखें" },
  "whatsapp_support": { en: "WhatsApp Support", hi: "व्हाट्सएप सहायता" },
  "need_help": { en: "Need Help?", hi: "सहायता चाहिए?" },
  "faq": { en: "FAQ", hi: "सामान्य प्रश्न" },
  "cancellation_policy": { en: "Cancellation Policy", hi: "रद्दीकरण नीति" },
  "free_cancellation": { en: "Free cancellation up to 48 hours before check-in", hi: "चेक-इन से 48 घंटे पहले तक मुफ्त रद्दीकरण" },
  "proximity_request": { en: "Proximity Request", hi: "निकटता अनुरोध" },
  "near_elevator": { en: "Near elevator", hi: "लिफ्ट के पास" },
  "same_floor_as": { en: "Same floor as", hi: "एक ही मंज़िल पर" },
  "accessibility": { en: "Accessibility", hi: "सुगम्यता" },
  "wheelchair_accessible": { en: "Wheelchair accessible rooms available", hi: "व्हीलचेयर सुगम कमरे उपलब्ध" },
  "confirmation_sent": { en: "Confirmation has been sent to your email", hi: "पुष्टि आपके ईमेल पर भेजी गई है" },
  "save_qr": { en: "Save this QR code for check-in", hi: "चेक-इन के लिए यह QR कोड सेव करें" },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Load persisted locale on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tbo-locale") as Locale;
      if (saved === "en" || saved === "hi") setLocaleState(saved);
    } catch {}
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("tbo-locale", l); } catch {}
  }, []);

  const t = useCallback(
    (key: string) => {
      return translations[key]?.[locale] || translations[key]?.en || key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Inline translated text — use in server components to make text reactive to locale */
export function T({ k }: { k: string }) {
  const { t } = useI18n();
  return <>{t(k)}</>;
}

/** Language Toggle Component */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <button
      onClick={() => setLocale(locale === "en" ? "hi" : "en")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm ${
        locale === "hi"
          ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-400"
          : "bg-card border-border text-foreground"
      } ${className}`}
      title={locale === "en" ? "हिंदी में देखें" : "View in English"}
    >
      <span className="text-sm">{locale === "en" ? "🇮🇳" : "🇬🇧"}</span>
      <span>{locale === "en" ? "हिंदी" : "EN"}</span>
    </button>
  );
}
