import { Hero, Features, Pricing, Footer } from '@/components/landing'

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Hero />
      <Features />
      <Pricing />
      <Footer />
    </main>
  )
}
