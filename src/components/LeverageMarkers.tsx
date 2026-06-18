type MarkerKind = 'hare' | 'tortoise'

export function ObMarker() {
  return (
    <span title="OB: out of bounds stand-in score" aria-label="OB: out of bounds stand-in score" className="inline-flex h-[0.78rem] min-w-[1.1rem] items-center justify-center border border-[#b21e23] bg-[#fff1ef] px-0.5 text-[8px] font-black leading-none text-[#b21e23]">
      OB
    </span>
  )
}

export function ObMarkerCorner() {
  return (
    <span className="absolute right-0.5 top-0.5 z-[1] overflow-visible leading-none">
      <ObMarker />
    </span>
  )
}

export function LeverageMarkerIcon({ kind }: { kind: MarkerKind }) {
  if (kind === 'hare') {
    return (
      <svg
        className="block h-[0.78rem] w-[1.1rem] overflow-visible"
        viewBox="0 0 497.930001 369.418408"
        preserveAspectRatio="xMidYMid meet"
        fill="currentColor"
        aria-hidden="true"
      >
        <g transform="translate(-28.069999,402.719228) scale(0.100000,-0.100000)">
          <path d="M3432 4023 c-21 -8 -42 -59 -42 -101 0 -55 15 -132 47 -234 25 -85 29 -90 95 -149 129 -115 284 -308 461 -574 55 -82 109 -160 120 -172 24 -27 18 -38 -17 -29 -40 10 -133 103 -209 210 -249 351 -425 541 -643 698 -216 155 -352 210 -404 163 -46 -41 -10 -203 86 -393 135 -266 283 -408 643 -618 141 -83 227 -156 250 -212 13 -30 12 -37 -12 -80 -14 -26 -39 -82 -57 -125 -51 -124 -105 -173 -223 -204 -110 -28 -285 -6 -662 82 -326 77 -615 102 -803 71 -107 -18 -238 -58 -310 -95 -24 -12 -45 -21 -46 -19 -2 2 -8 17 -15 35 -17 42 -72 98 -124 125 -60 31 -185 32 -242 1 -99 -53 -150 -136 -148 -238 1 -104 57 -190 153 -235 38 -18 49 -28 44 -39 -28 -62 -54 -160 -64 -236 -23 -179 -57 -210 -225 -208 -171 3 -203 -16 -310 -176 -131 -197 -207 -278 -356 -383 -127 -90 -174 -205 -110 -269 25 -24 37 -29 80 -29 69 0 147 31 238 97 87 61 140 113 261 254 150 176 180 194 320 185 51 -3 98 -9 104 -12 6 -4 -13 -16 -43 -27 -82 -30 -109 -56 -166 -158 -69 -124 -126 -195 -215 -265 -86 -68 -86 -69 -120 -114 -85 -116 -39 -235 85 -215 147 24 298 157 478 421 46 67 87 116 112 132 39 26 47 27 226 33 208 7 246 15 376 82 65 33 102 62 193 154 62 62 126 120 142 128 72 37 163 17 458 -104 292 -119 407 -148 632 -157 80 -3 154 -7 166 -9 12 -3 50 -28 85 -56 72 -58 106 -75 304 -149 266 -100 353 -148 504 -284 111 -99 186 -138 279 -144 59 -4 82 -1 108 13 63 34 69 108 15 182 -67 93 -256 234 -459 343 -133 71 -213 120 -240 147 -44 43 335 -17 453 -71 39 -18 113 -61 165 -95 144 -94 259 -121 350 -85 47 19 60 38 60 90 0 49 -29 93 -93 142 -146 112 -296 184 -497 242 -187 53 -328 99 -335 110 -3 4 2 25 11 45 8 21 26 80 38 131 29 116 50 152 106 184 41 22 58 24 170 26 138 2 180 12 256 65 41 28 104 109 157 202 28 50 16 108 -40 192 -66 100 -175 245 -220 291 -91 96 -212 165 -360 205 -94 26 -120 38 -154 76 -43 45 -74 119 -108 253 -81 316 -151 465 -307 650 -156 185 -377 333 -452 303z m1160 -1633 c25 -26 29 -36 24 -63 -6 -34 -47 -77 -72 -77 -28 0 -75 31 -84 56 -15 39 -12 53 19 85 39 38 74 38 113 -1z" />
        </g>
      </svg>
    )
  }

  return (
    <svg
      className="block h-[0.78rem] w-[1.1rem] overflow-visible"
      viewBox="0 0 494.433958 253.794037"
      preserveAspectRatio="xMidYMid meet"
      fill="currentColor"
      aria-hidden="true"
    >
      <g transform="translate(-27.066042,282.794037) scale(0.100000,-0.100000)">
        <path d="M2334 2819 c-122 -11 -321 -52 -419 -86 -59 -21 -83 -35 -94 -54 -14 -25 -11 -31 52 -140 151 -259 141 -252 342 -237 77 5 257 8 400 5 167 -2 268 0 283 6 31 14 242 314 242 344 0 36 -23 53 -113 82 -120 38 -282 69 -426 81 -129 11 -137 11 -267 -1z" />
        <path d="M1565 2565 c-123 -77 -196 -138 -312 -259 -96 -99 -237 -292 -249 -342 -11 -43 14 -65 159 -134 167 -80 342 -150 373 -150 36 0 65 34 175 210 57 91 117 185 134 210 55 82 78 135 72 161 -8 30 -193 340 -210 351 -26 16 -57 6 -142 -47z" />
        <path d="M3237 2598 c-14 -12 -71 -90 -127 -172 -71 -106 -100 -158 -100 -179 0 -20 26 -72 74 -151 95 -155 207 -359 290 -523 73 -146 86 -163 125 -163 56 0 327 202 440 328 94 103 93 111 -29 307 -135 217 -323 403 -538 533 -74 45 -102 49 -135 20z" />
        <path d="M2212 2200 c-78 -4 -156 -13 -173 -20 -33 -14 -69 -64 -254 -355 -161 -252 -151 -216 -136 -489 7 -126 17 -240 22 -253 5 -13 20 -28 34 -33 42 -16 505 -12 677 6 275 28 567 96 792 185 170 68 186 80 186 131 0 29 -211 428 -332 630 -91 150 -105 169 -140 183 -48 19 -451 28 -676 15z" />
        <path d="M4620 2046 c-141 -40 -235 -120 -363 -312 -76 -114 -136 -149 -241 -141 l-70 6 -56 -48 c-386 -333 -909 -538 -1535 -602 -152 -16 -594 -16 -745 0 -299 32 -564 88 -786 166 l-123 43 -62 -41 c-83 -53 -189 -101 -279 -126 -84 -24 -93 -30 -88 -62 9 -68 231 -88 422 -39 43 11 120 40 172 64 81 38 94 42 94 27 0 -10 -29 -46 -65 -79 -148 -140 -235 -309 -235 -458 0 -53 4 -67 27 -95 47 -56 66 -59 353 -59 l261 0 24 25 c31 30 32 70 3 150 -20 59 -21 61 -4 97 11 22 47 61 91 96 l74 58 108 -22 c269 -54 521 -78 808 -77 321 1 576 32 850 103 l120 32 41 -46 c55 -60 64 -99 51 -220 -13 -113 -6 -141 42 -173 33 -23 40 -23 298 -23 l265 0 29 29 c25 25 29 37 29 84 0 130 -91 355 -195 480 -35 42 -51 69 -43 71 7 2 63 16 125 30 195 46 319 104 546 254 155 102 197 119 330 133 175 18 257 50 299 117 20 32 23 50 23 133 0 90 -2 99 -38 171 -83 170 -249 270 -442 267 -38 0 -90 -6 -115 -13z m257 -209 c7 -7 15 -27 19 -44 5 -27 1 -37 -24 -63 -36 -35 -46 -37 -89 -10 -28 17 -33 26 -33 57 0 43 6 55 35 71 23 14 74 8 92 -11z" />
        <path d="M927 1799 c-10 -6 -44 -63 -76 -128 -32 -65 -86 -161 -119 -213 -65 -100 -74 -132 -44 -167 49 -58 386 -161 697 -211 135 -22 158 -19 174 23 10 28 -15 403 -30 439 -8 20 -29 34 -84 57 -41 17 -76 31 -79 31 -8 0 -275 119 -338 151 -63 32 -74 34 -101 18z" />
      </g>
    </svg>
  )
}

export function LeverageMarker({ kind }: { kind: MarkerKind }) {
  const label = kind === 'hare' ? 'Hare: your golfer to root for' : 'Tortoise: opponent golfer to root against'
  const className = 'text-[#111]'
  return (
    <span title={label} aria-label={label} className={`inline-flex h-[0.78rem] w-[1.1rem] shrink-0 items-center justify-center overflow-visible leading-none ${className}`}>
      <LeverageMarkerIcon kind={kind} />
    </span>
  )
}

export function LeverageMarkerCorner({ kind }: { kind?: MarkerKind }) {
  if (!kind) return null
  return (
    <span className="absolute right-0.5 top-0.5 z-[1] overflow-visible leading-none">
      <LeverageMarker kind={kind} />
    </span>
  )
}

export function LeverageMarkerLegend({ showTortoise = true, className = '' }: { showTortoise?: boolean; className?: string }) {
  return (
    <div className={`flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#fffdf8] px-2 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#111] ${className}`}>
      <span className="inline-flex items-center gap-1"><LeverageMarker kind="hare" /> Root for</span>
      {showTortoise ? <span className="inline-flex items-center gap-1"><LeverageMarker kind="tortoise" /> Root against</span> : null}
      <details className="relative inline-flex">
        <summary
          aria-label="How root for and root against are picked"
          className="flex h-4 w-4 cursor-pointer list-none items-center justify-center border border-[#123c2f] bg-white text-[10px] font-black leading-none text-[#123c2f] shadow-[1px_1px_0_#d8cab0] marker:hidden hover:bg-[#fff4cf] [&::-webkit-details-marker]:hidden"
        >
          i
        </summary>
        <div className="absolute right-0 top-[calc(100%+6px)] z-[260] w-72 border-2 border-[#123c2f] bg-[#fffdf8] p-3 text-left normal-case tracking-normal text-[#1f2a24] shadow-[5px_5px_0_#d8cab0] sm:right-auto sm:left-1/2 sm:-translate-x-1/2">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#123c2f]">How this works</p>
          <p className="mt-1 text-xs font-semibold leading-5">
            We run a leverage algorithm on the live standings and every entry&apos;s picks. It compares your entry with the rest of the pool and marks the golfers whose scores can swing your rank the most.
          </p>
          <div className="mt-2 space-y-1 border-t border-[#d8cab0] pt-2 text-xs font-semibold leading-5">
            <p><span className="font-black uppercase text-[#123c2f]">Root for:</span> one of your picks who can move you up.</p>
            {showTortoise ? <p><span className="font-black uppercase text-[#123c2f]">Root against:</span> another entry&apos;s pick who can pull you back.</p> : null}
          </div>
        </div>
      </details>
    </div>
  )
}
