"use client";

export function IntroWallFilm() {
  return (
    <figure className="about-film">
      <video
        className="about-film-video"
        autoPlay
        muted
        playsInline
        disablePictureInPicture
        poster="/hero-wall.png"
        onEnded={(event) => {
          const video = event.currentTarget;
          const last = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : 0;
          video.pause();
          video.currentTime = last;
        }}
      >
        <source src="/hero-wall.mp4" type="video/mp4" />
      </video>
      <figcaption className="sr-only">The Wall being inscribed.</figcaption>
    </figure>
  );
}
