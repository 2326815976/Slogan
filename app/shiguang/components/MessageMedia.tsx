import AudioPlayer from './AudioPlayer';

export default function MessageMedia({ image, audio, video }: { image?: string; audio?: string; video?: string }) {
  return <>
    {image && <a className="sg-message-media-link" href={image} target="_blank" rel="noreferrer" aria-label="查看原图">
      <img className="sg-message-media-image" src={`${image}?variant=preview`} alt="图片附件，点击查看原图" loading="lazy" />
    </a>}
    {video && <video className="sg-message-media-video" src={video} controls playsInline preload="metadata" />}
    {audio && <div className="sg-audio-player-row"><AudioPlayer src={audio} variant="progress" /></div>}
  </>;
}
