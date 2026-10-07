import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(request) {
    const token = request.nextauth.token;
    const pathname = request.nextUrl.pathname;
    const isApi = pathname.startsWith("/api/");

    // First-login (or admin-reset) flow: the user must set a new password
    // before using anything else. API routes are skipped so downloads/saves
    // fail auth-side rather than redirecting binary responses.
    if (token?.mustChangePassword && !isApi) {
      const target = token.role === "ADMIN" ? "/admin/conta" : "/app/conta";
      if (pathname !== target) {
        const url = new URL(target, request.url);
        url.searchParams.set("force", "1");
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }

    // Funcionários (STAFF) never export data (would leak the mentorado's numbers).
    // Their per-section page access is enforced in the /app page guards, which
    // read live permissions from the database.
    if (token?.role === "STAFF" && isApi) {
      return new NextResponse("Sem permissão", { status: 403 });
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login"
    }
  }
);

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/api/exports/:path*"]
};
