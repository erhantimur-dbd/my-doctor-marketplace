"use client";

/**
 * Payment method icons for the footer.
 * Compact inline SVGs – no external assets needed.
 */

const iconClass = "h-8 w-auto";

function Visa() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="Visa" role="img">
      <rect width="48" height="32" rx="4" fill="#1A1F71" />
      <path
        d="M19.5 21h-2.7l1.7-10.5h2.7L19.5 21zm11.2-10.2c-.5-.2-1.4-.4-2.4-.4-2.6 0-4.5 1.4-4.5 3.4 0 1.5 1.3 2.3 2.3 2.8 1 .5 1.4.8 1.4 1.3 0 .7-.8 1-1.6 1-1.1 0-1.6-.2-2.5-.5l-.3-.2-.4 2.2c.6.3 1.8.5 3 .5 2.8 0 4.6-1.4 4.6-3.5 0-1.2-.7-2.1-2.2-2.8-.9-.5-1.5-.8-1.5-1.3 0-.4.5-.9 1.5-.9.9 0 1.5.2 2 .4l.2.1.4-2.1zm6.8 0h-2c-.6 0-1.1.2-1.4.8L30 21h2.8l.6-1.5h3.4l.3 1.5H40l-2.3-10.5h-2.2v.3zm-2.3 6.7l1.4-3.9.2-.6.3 1.7.8 2.8h-2.7zM16.3 10.5L13.7 18l-.3-1.4c-.5-1.7-2-3.6-3.8-4.5l2.4 8.9h2.8l4.2-10.5h-2.7z"
        fill="#fff"
      />
      <path
        d="M11.5 10.5H7.3l-.1.3c3.3.8 5.5 2.9 6.4 5.4l-.9-4.7c-.2-.7-.7-.9-1.2-1z"
        fill="#F9A533"
      />
    </svg>
  );
}

function Mastercard() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="Mastercard" role="img">
      <rect width="48" height="32" rx="4" fill="#252525" />
      <circle cx="19" cy="16" r="8" fill="#EB001B" />
      <circle cx="29" cy="16" r="8" fill="#F79E1B" />
      <path
        d="M24 9.8a8 8 0 0 1 3 6.2 8 8 0 0 1-3 6.2 8 8 0 0 1-3-6.2 8 8 0 0 1 3-6.2z"
        fill="#FF5F00"
      />
    </svg>
  );
}

function Amex() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="American Express" role="img">
      <rect width="48" height="32" rx="4" fill="#006FCF" />
      <text
        x="24"
        y="14"
        textAnchor="middle"
        fill="#fff"
        fontSize="6"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        AMERICAN
      </text>
      <text
        x="24"
        y="21"
        textAnchor="middle"
        fill="#fff"
        fontSize="6"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        EXPRESS
      </text>
    </svg>
  );
}

function ApplePay() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="Apple Pay" role="img">
      <rect width="48" height="32" rx="4" fill="#000" />
      <g fill="#fff">
        <path d="M14.3 11.2c-.4.5-1 .8-1.6.8-.1-.6.2-1.3.5-1.7.4-.5 1-.8 1.5-.8.1.7-.2 1.3-.4 1.7zm.4.9c-.9 0-1.6.5-2 .5s-1-.5-1.7-.5c-.9 0-1.7.5-2.1 1.3-.9 1.6-.2 3.9.7 5.2.4.6 1 1.3 1.7 1.3.7 0 .9-.4 1.7-.4s1 .4 1.7.4c.7 0 1.2-.7 1.6-1.3.5-.7.7-1.5.7-1.5-.8-.3-1.3-1.2-1.3-2.2 0-.9.5-1.7 1.2-2-.5-.7-1.2-1-2.1-.8z" />
        <path d="M21.1 10.8c2.1 0 3.5 1.4 3.5 3.5 0 2.1-1.5 3.5-3.6 3.5h-2.3v3.7H17v-10.7h4.1zm-2.4 5.6h1.9c1.4 0 2.3-.8 2.3-2.1s-.8-2.1-2.3-2.1h-1.9v4.2zm6.4 2c0-1.4 1-2.2 2.9-2.3l2.1-.1v-.6c0-.9-.6-1.4-1.6-1.4-.9 0-1.5.4-1.7 1.1h-1.5c.1-1.4 1.3-2.4 3.2-2.4 1.9 0 3.1 1 3.1 2.6v5.4h-1.6v-1.3c-.5.9-1.4 1.4-2.5 1.4-1.6 0-2.6-.9-2.6-2.4zm5-1v-.6l-1.9.1c-1 .1-1.6.5-1.6 1.2 0 .7.6 1.2 1.5 1.2 1.2 0 2-.8 2-1.9zm3.3 4.7v-1.3c.1 0 .4.1.6.1.9 0 1.3-.4 1.6-1.3l.2-.5-2.9-8h1.8l2 6.4 2-6.4h1.7l-3 8.4c-.7 1.9-1.4 2.6-3.1 2.6-.2 0-.7 0-.9-.1z" />
      </g>
    </svg>
  );
}

function GooglePay() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="Google Pay" role="img">
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#e0e0e0" strokeWidth=".5" />
      <g transform="translate(4,6) scale(0.55)">
        <path d="M35.8 18.2l-8.3 0 0-2.5 5.7 0c-.3-1.6-1.1-2.9-2.3-3.8l0 0 3.1-2.4c1.8 1.7 2.9 4.2 2.9 7.2 0 .5 0 1-.1 1.5z" fill="#4285F4" />
        <path d="M19.8 25.5c3.2 0 5.8-1.1 7.8-2.9l-3.1-2.4c-1.1.7-2.4 1.1-4.1 1.1-3.2 0-5.8-2.1-6.8-5l-3.2 2.5c1.9 3.9 5.8 6.7 10 6.7z" fill="#34A853" />
        <path d="M13 18.2c-.3-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3l0 0-3.2-2.5c-.7 1.4-1.1 3-1.1 4.8s.4 3.4 1.1 4.8l3.2-2.5z" fill="#FBBC04" />
        <path d="M19.8 8.6c1.8 0 3.4.6 4.7 1.8l2.9-2.9c-2-1.8-4.5-2.9-7.6-2.9-4.2 0-8.1 2.8-10 6.7l3.2 2.5c1-2.9 3.6-5.2 6.8-5.2z" fill="#EA4335" />
      </g>
      <g fill="#5F6368">
        <path d="M30.5 17.3v-1.5h-4.7v1.1h3.5c-.1 1-.5 1.7-1.1 2.2l0 0 .9.7c.8-.8 1.3-1.9 1.4-2.5z" fill="#4285F4" transform="translate(2, -1.5) scale(0.8)" />
      </g>
      <text
        x="34"
        y="19.5"
        fontSize="7.5"
        fontFamily="Arial, sans-serif"
        fontWeight="500"
        fill="#5F6368"
      >
        Pay
      </text>
    </svg>
  );
}

function DebitCard() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="Debit Card" role="img">
      <rect width="48" height="32" rx="4" fill="#6B7280" />
      <rect x="6" y="9" width="10" height="7" rx="1" fill="#D1D5DB" />
      <rect x="6" y="20" width="16" height="2" rx="1" fill="#9CA3AF" />
      <rect x="6" y="24" width="10" height="2" rx="1" fill="#9CA3AF" />
      <text
        x="42"
        y="12"
        textAnchor="end"
        fill="#D1D5DB"
        fontSize="5"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        DEBIT
      </text>
    </svg>
  );
}

function CreditCard() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="Credit Card" role="img">
      <rect width="48" height="32" rx="4" fill="#1E40AF" />
      <rect x="6" y="9" width="10" height="7" rx="1" fill="#93C5FD" />
      <rect x="6" y="20" width="16" height="2" rx="1" fill="#60A5FA" />
      <rect x="6" y="24" width="10" height="2" rx="1" fill="#60A5FA" />
      <text
        x="42"
        y="12"
        textAnchor="end"
        fill="#93C5FD"
        fontSize="4.5"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
      >
        CREDIT
      </text>
    </svg>
  );
}

function PayPal() {
  return (
    <svg viewBox="0 0 48 32" className={iconClass} aria-label="PayPal" role="img">
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#e0e0e0" strokeWidth=".5" />
      <path
        d="M18.5 24.2h-2.4c-.2 0-.3-.1-.3-.3l1.9-12c0-.1.1-.2.3-.2h4.3c1.4 0 2.5.3 3.2 1 .6.6.9 1.5.7 2.6-.4 2.8-2.3 4.2-5.1 4.2h-1.3c-.2 0-.3.1-.3.3l-.6 3.8c0 .1-.1.2-.3.2l-.1.4z"
        fill="#253B80"
      />
      <path
        d="M33.4 12.3c-.4 2.8-2.3 4.2-5.1 4.2h-1.3c-.2 0-.3.1-.3.3l-.8 5.1c0 .1.1.2.2.2h2.2c.2 0 .3-.1.3-.2l.5-3.3c0-.2.2-.3.3-.3h.8c2.5 0 4.4-1 4.9-3.9.2-1.2.1-2.1-.5-2.8-.2-.2-.5-.4-.8-.5-.1.4-.2.8-.4 1.2z"
        fill="#179BD7"
      />
      <path
        d="M21.8 12c.1-.1.2-.2.3-.2h4.3c.5 0 1 0 1.4.1.1 0 .3.1.4.1.1 0 .3.1.4.1.1 0 .1 0 .2.1.3.1.5.2.7.4.3-1.7 0-2.9-.9-4-1-1.2-2.8-1.7-5.1-1.7h-4.3c-.3 0-.5.2-.5.4L16.6 20c0 .2.1.3.3.3h2.6l.7-4.2 1.6-4.1z"
        fill="#253B80"
      />
    </svg>
  );
}

export function PaymentIcons() {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Visa />
      <Mastercard />
      <Amex />
      <PayPal />
      <ApplePay />
      <GooglePay />
      <CreditCard />
      <DebitCard />
    </div>
  );
}
