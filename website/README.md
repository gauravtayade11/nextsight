# NextSight AI Website

Marketing website for NextSight AI built with Next.js 14, React 18, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3001 in your browser
```

The website will run on port 3001 to avoid conflicts with the main app (port 3000).

### Build for Production

```bash
# Build the website
npm run build

# Start production server
npm run start
```

## Project Structure

```
website/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (marketing)/        # Marketing pages group
│   │   │   ├── page.tsx        # Homepage
│   │   │   ├── features/
│   │   │   └── about/
│   │   ├── docs/               # Documentation
│   │   │   ├── page.tsx
│   │   │   └── installation/
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── nav.tsx
│   │   │   └── footer.tsx
│   │   └── sections/           # Page sections
│   │       ├── hero.tsx
│   │       ├── features.tsx
│   │       ├── comparison.tsx
│   │       └── cta.tsx
│   └── lib/
│       ├── utils.ts            # Utility functions
│       └── constants.ts        # App constants
├── public/
│   └── images/                 # Static images
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server on port 3001 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Deployment

### Vercel (Recommended)

The easiest way to deploy is with Vercel:

1. Push your code to GitHub
2. Import the project to Vercel
3. Set the root directory to `website/`
4. Deploy!

Or use the Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from the website directory
cd website
vercel
```

### Other Platforms

#### Netlify

1. Build command: `npm run build`
2. Publish directory: `.next`
3. Base directory: `website/`

#### Static Export (GitHub Pages, S3, etc.)

```bash
# Update next.config.js to enable static export
# output: 'export'

npm run build
# Static files will be in the out/ directory
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Available variables:

- `NEXT_PUBLIC_SITE_URL` - Base URL for production
- `NEXT_PUBLIC_GA_ID` - Google Analytics ID (optional)

## Customization

### Update Content

1. **Constants** - Edit `src/lib/constants.ts` for version, links, etc.
2. **Navigation** - Edit `NAV_ITEMS` in `src/lib/constants.ts`
3. **Footer** - Edit navigation links in `src/components/ui/footer.tsx`
4. **Features** - Edit feature lists in `src/components/sections/features.tsx`

### Add Images

Place images in `public/images/` and reference them:

```tsx
<img src="/images/your-image.png" alt="Description" />
```

### Add New Pages

Create a new directory in `src/app/` with a `page.tsx` file:

```tsx
// src/app/new-page/page.tsx
export default function NewPage() {
  return <div>New Page Content</div>;
}
```

## Development Tips

### Hot Reload

Next.js automatically reloads when you save files. If it doesn't:

```bash
# Restart the dev server
npm run dev
```

### Type Checking

```bash
# Run TypeScript compiler
npx tsc --noEmit
```

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix issues
npm run lint -- --fix
```

## Contributing

1. Make sure all changes are in the `website/` directory
2. Test locally with `npm run dev`
3. Build to ensure no errors: `npm run build`
4. Create a pull request

## Support

- [Report Issues](https://github.com/gauravtayade11/nextsight/issues)
- [Discussions](https://github.com/gauravtayade11/nextsight/discussions)

## License

MIT License - see [LICENSE](../LICENSE) for details.
