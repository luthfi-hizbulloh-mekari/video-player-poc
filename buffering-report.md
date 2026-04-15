# Buffering Comparison Report

## Objective

Compare the network and buffering behavior of four playback combinations in this PoC:

- native + mp4
- native + hls
- video.js + mp4
- video.js + hls

The main question was whether HLS is always better for buffering, or whether standard progressive MP4 loading is already sufficient.

## Test Setup

- App URL: `http://localhost:5173/`
- Browser automation: Cursor browser MCP tools
- Media fixture: `sample`
- Environment: local development server
- Additional verification: `curl -I` against the MP4 endpoint

Each scenario was tested from a fresh page load where possible, then playback was started and network activity was observed.

## Observed Network Behavior

### Native + MP4

- Playback triggered a single media request to `http://localhost:5173/media/mp4/sample.mp4`.
- The browser treated it as a media stream rather than as many visible chunk requests in the network log.
- This is consistent with progressive MP4 playback.

### Native + HLS

- Playback requested `http://localhost:5173/media/hls/sample/master.m3u8`.
- After that, the player fetched many `segment-xxx.ts` files in sequence.
- This matches typical HLS behavior: one playlist plus segmented transport stream downloads.

### Video.js + MP4

- In this run, the browser MCP network output did not clearly show the MP4 media request.
- This is most likely a limitation of the network capture for this playback path, not proof that Video.js MP4 avoided loading media.
- The playback path is still expected to use the MP4 asset as the source.

### Video.js + HLS

- Playback requested `master.m3u8` and then many `segment-xxx.ts` files.
- The log also showed repeated playlist and early segment refetches, which is normal for HLS clients such as Video.js VHS.

## MP4 Progressive Loading Support

The MP4 endpoint returned these important headers:

```text
accept-ranges: bytes
content-type: video/mp4
content-length: 65654056
```

This confirms the MP4 endpoint supports byte-range requests. In practice, that means the client is not limited to downloading the whole file before playback can start.

## Conclusion

HLS is **not always better** for buffering.

What this PoC demonstrates is:

- Progressive MP4 can already provide efficient playback when the server supports `Accept-Ranges`.
- HLS changes the delivery model into playlist plus segment fetching.
- HLS is especially useful when you need adaptive bitrate streaming, live streaming workflows, or CDN-friendly segment distribution.
- For single-bitrate VOD on a stable connection, progressive MP4 is often already enough.

So the better conclusion is:

> HLS is not automatically superior for buffering alone. It is usually better when you need adaptive streaming and segmented delivery, while progressive MP4 can already be sufficient for simple VOD playback.

## Limitations

- This test was run on localhost, so network latency and bandwidth pressure were minimal.
- The browser MCP network log is useful for request shape, but not perfect for deep media internals.
- The strongest comparison for buffering quality would be to test under artificial network throttling.

## Recommended Next Step

To make the result more convincing, run all four scenarios under a throttled network profile and compare:

- startup to first playing
- total buffering count
- cumulative buffering duration

Those metrics would provide a better answer to the real buffering question than request shape alone.
