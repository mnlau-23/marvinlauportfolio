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
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/rahh.mp4', alt: 'Image 1' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/Screenshot%202026-04-14%20at%207.33.25%20PM.png', alt: 'Image 2' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/savee.mov', alt: 'Image 3' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/Screenshot%202026-04-14%20at%205.24.51%20PM.png', alt: 'Image 4' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/newestt.mp4', alt: 'Image 5' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/edited.mp4', alt: 'Image 6' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/Screenshot%202026-04-14%20at%208.53.18%20PM.png', alt: 'Image 7' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/Rembrandt%20Harmenszoon%20van%20Rijn.png', alt: 'Image 8' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/winning%20creative%202.mp4', alt: 'Image 9' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/pgn%201.png', alt: 'Image 10' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/pgn%202.png', alt: 'Image 11' },
		{ src: 'https://bpousoyupeexbowfgtbp.supabase.co/storage/v1/object/public/Marketing/dresses.mov, alt: 'Image 12' },
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
