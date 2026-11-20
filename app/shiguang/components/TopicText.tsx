import { topicSegments } from '@/lib/shiguang/topics';

export default function TopicText({
  content,
  className = '',
  onTopicClick,
}: {
  content: string;
  className?: string;
  onTopicClick?: (topic: string) => void;
}) {
  return <span className={className}>
    {topicSegments(content).map((segment, index) => segment.topic
      ? onTopicClick
        ? <button key={index} type="button" className="sg-topic-tag" aria-label={`筛选话题 ${segment.topic}`} onClick={() => onTopicClick(segment.topic!)}>{segment.text}</button>
        : <span key={index} className="sg-topic-tag">{segment.text}</span>
      : <span key={index}>{segment.text}</span>)}
  </span>;
}
