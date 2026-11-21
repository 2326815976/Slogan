import { notFound } from 'next/navigation';
import { ENTRY_KINDS } from '@/lib/shiguang/types';
import EntriesPage from '../components/EntriesPage';
import MoodCalendar from '../components/MoodCalendar';

export default async function Page({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const match = ENTRY_KINDS.find(k => k === kind && k !== 'collection');
  if (!match) notFound();
  return match === 'mood' ? <MoodCalendar /> : <EntriesPage kind={match} />;
}
