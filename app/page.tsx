'use client';

import dynamic from 'next/dynamic';

const InfiniteGallery = dynamic(() => import('@/components/InfiniteGallery'), {
	ssr: false,
	loading: () => (
		<div className="h-screen w-full flex items-center justify-center bg-black">
			<div className="animate-pulse text-white/50">Loading gallery...</div>
		</div>
	),
});

export default function Home() {
	const sampleImages = [
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-w2tftoVl3cV3Z5Qubu2qeaYYKi4pwj.webp', alt: 'Image 1' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/2-uj2Fvq3DpWH7LtGcK6WkaU7H6WX4S8.webp', alt: 'Image 2' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-kw7Z8s0ETYOQu5g63w1zqTefT6d5Vf.webp', alt: 'Image 3' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/4-1kiiVmgKLgNoQjPdgIMvN1pDPxeoOj.webp', alt: 'Image 4' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/5-uCoetbft1EzlxjzDBY7AVgb2Mk6y4g.webp', alt: 'Image 5' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/6-eLf5PHoVywNElQQaGvdrRFnxKMnc1f.webp', alt: 'Image 6' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/7-Hfd0omnFSE1FXfLaK7Znv838dQWNke.webp', alt: 'Image 7' },
		{ src: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/8-qqbYhuiLntJrbWVXp2KVRuyfQCdJ78.webp', alt: 'Image 8' },
	];

	return (
		<main className="min-h-screen ">
			<InfiniteGallery
				images={sampleImages}
				speed={1.2}
				zSpacing={3}
				visibleCount={12}
				falloff={{ near: 0.8, far: 14 }}
				className="h-screen w-full rounded-lg overflow-hidden"
			/>
			<div className="h-screen inset-0 pointer-events-none fixed flex items-center justify-center text-center px-3 mix-blend-exclusion text-white">
				<h1 className="font-serif text-4xl md:text-7xl tracking-tight">
					<span className="italic">I create;</span> therefore I am
				</h1>
			</div>

			<div className="text-center fixed bottom-10 left-0 right-0 font-mono uppercase text-[11px] font-semibold">
				<p>Use mouse wheel, arrow keys, or touch to navigate</p>
				<p className=" opacity-60">
					Auto-play resumes after 3 seconds of inactivity
				</p>
			</div>
		</main>
	);
}
