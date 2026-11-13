export default function BookingLoading() {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 rounded-md flex items-center justify-center mx-auto animate-pulse border bg-background text-foreground">
          <svg className="h-6 w-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Loading booking...</p>
          <p className="text-xs text-muted-foreground mt-1">Preparing your reservation form</p>
        </div>
      </div>
    </div>
  );
}
