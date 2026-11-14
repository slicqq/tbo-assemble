export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; status?: number; name?: string } | null;
  switch (e?.code) {
    case "email_address_not_authorized": return "This address cannot receive mail from the current test email service.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Too many attempts. Please wait a little before trying again.";
    case "invalid_credentials": return "Incorrect email or password. If you haven’t registered here, create an account first.";
    case "email_not_confirmed": return "Please confirm your email before signing in. Check your inbox and spam folder.";
    case "user_already_exists":
    case "email_exists": return "An account may already exist. Try signing in instead.";
    case "weak_password": return "That password doesn’t meet the requirements. Try a longer, unique password.";
    case "email_address_invalid":
    case "validation_failed": return "Please check your email address and password and try again.";
    case "signup_disabled": return "Account creation is currently unavailable. Please try again later.";
    default:
      if (e?.status === 429) return "Too many attempts. Please wait a little before trying again.";
      if (e?.name === "AuthRetryableFetchError" || error instanceof TypeError) return "Couldn’t reach the sign-in service. Check your connection and try again.";
      return "We couldn’t complete that request. Please try again or contact the project owner.";
  }
}

