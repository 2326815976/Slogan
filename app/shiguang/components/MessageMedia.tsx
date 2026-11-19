export default function MessageMedia({ image, audio, video }: { image?: string; audio?: string; video?: string }) {
  return <>
    {image && <a href={image} target="_blank" rel="noreferrer" aria-label="查看原图">
      <img src={`${image}?variant=preview`} alt="图片附件，点击查看原图" loading="lazy" className="max-h-64 max-w-full rounded-xl object-contain" />
    </a>}
    {video && <video src={video} controls playsInline preload="none" className="max-h-80 max-w-full rounded-xl" />}
    {audio && <audio src={audio} controls preload="none" className="max-w-full" />}
  </>;
}
