interface Props {
  variant?: 'hero' | 'dark' | 'final';
}

export default function AnimatedBlobs({ variant = 'hero' }: Props) {
  if (variant === 'final') {
    return (
      <>
        <div className="pointer-events-none absolute top-10 -end-20 w-[500px] h-[500px] rounded-full animate-blob-1"
          style={{ background: 'rgba(167,139,250,0.18)', filter: 'blur(120px)' }} />
        <div className="pointer-events-none absolute bottom-10 -start-32 w-[450px] h-[450px] rounded-full animate-blob-2"
          style={{ background: 'rgba(236,72,153,0.12)', filter: 'blur(120px)' }} />
        <div className="pointer-events-none absolute top-1/3 start-1/3 w-[400px] h-[400px] rounded-full animate-blob-3"
          style={{ background: 'rgba(124,58,237,0.18)', filter: 'blur(120px)' }} />
      </>
    );
  }
  if (variant === 'dark') {
    return (
      <>
        <div
          className="pointer-events-none absolute top-10 -end-20 w-[400px] h-[400px] rounded-full animate-blob-1"
          style={{ background: 'rgba(167, 139, 250, 0.1)', filter: 'blur(120px)' }}
        />
        <div
          className="pointer-events-none absolute bottom-10 -start-20 w-[350px] h-[350px] rounded-full animate-blob-2"
          style={{ background: 'rgba(236, 72, 153, 0.06)', filter: 'blur(100px)' }}
        />
      </>
    );
  }
  return (
    <>
      <div
        className="pointer-events-none absolute top-10 -end-32 w-[400px] h-[400px] rounded-full animate-blob-1"
        style={{ background: 'rgba(124, 58, 237, 0.15)', filter: 'blur(100px)' }}
      />
      <div
        className="pointer-events-none absolute top-1/2 -start-20 w-[300px] h-[300px] rounded-full animate-blob-2"
        style={{ background: 'rgba(167, 139, 250, 0.1)', filter: 'blur(80px)' }}
      />
      <div
        className="pointer-events-none absolute bottom-20 start-1/3 w-[350px] h-[350px] rounded-full animate-blob-3"
        style={{ background: 'rgba(236, 72, 153, 0.08)', filter: 'blur(90px)' }}
      />
    </>
  );
}