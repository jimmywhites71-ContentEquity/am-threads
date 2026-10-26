import Judge from './Judge'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Judging · AM Intelligence' }

// The Content Equity team's judging page: two anonymised pieces side by side, two questions.
export default function Page({ searchParams }: { searchParams: { set?: string } }) {
  return <Judge setId={searchParams.set || ''} />
}
