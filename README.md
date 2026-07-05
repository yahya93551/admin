# Next.js Admin Dashboard

A Next.js admin dashboard application with TypeScript, Tailwind CSS, and Supabase authentication for admin role-based access control.

## Features

- **Authentication**: Supabase-based user authentication
- **Role-Based Access Control**: Admin-only access to dashboard
- **Responsive Design**: Built with Tailwind CSS
- **TypeScript**: Full type safety
- **Next.js 13+**: App Router with latest features

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd admin
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Update `.env.local` with your Supabase credentials (uncomment and replace the placeholders):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your URL and anon key
3. In Authentication > Users, create admin users and set their metadata role to 'admin'

## Project Structure

```
admin/
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── login/          # Login page
│   ├── unauthorized/   # Unauthorized access page
│   └── page.tsx        # Home page (redirects based on auth)
├── lib/
│   └── supabase.ts     # Supabase client configuration
├── middleware.ts       # Route protection middleware
└── .env.local          # Environment variables
```

## Building for Production

```bash
npm run build
npm start
```

## Technologies Used

- **Next.js** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Supabase** - Authentication and database
- **ESLint** - Code linting

## License

MIT
