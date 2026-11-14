# Return photos of a specific place

The Place Photos (New) service is a read-only REST API that lets you retrieve
and resize photographic content associated with a specific place in the Google
Places database.

## Prerequisites

To request a photo, you must first obtain a valid photo resource `name`. You
cannot generate or cache this identifier; it must be retrieved dynamically from
the `photos[]` array returned by a prior Places API request:

-   **Place Details (New)**: Include `photos` in the `X-Goog-FieldMask` header.
-   **Text Search (New)** or **Nearby Search (New)**: Include `places.photos` in
    the `X-Goog-FieldMask` header.

Each API can return up to 10 photo references per place. The photo resource
`name` takes the following format: `places/{PLACE_ID}/photos/{PHOTO_RESOURCE}`

## Workflow

### Step 1: Retrieve the Photo Resource Name

If you do not already have a photo resource `name`, query Place Details (New)
(or a Search endpoint) with `photos` specified in the field mask.

```bash
curl -X GET \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-FieldMask: id,displayName,photos" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://places.googleapis.com/v1/places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E"
```

**Example Response Excerpt:**

```json
{
  "id": "ChIJ2fzCmcW7j4AR2JzfXBBoh6E",
  "displayName": {
    "text": "Golden Gate Bridge"
  },
  "photos": [
    {
      "name": "places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E/photos/AUacShh3_Dd8yvV2JZMtNjjbbSbFhSv-0VmUN",
      "widthPx": 6000,
      "heightPx": 4000,
      "authorAttributions": [
        {
          "displayName": "John Smith",
          "uri": "//maps.google.com/maps/contrib/101563",
          "photoUri": "//lh3.googleusercontent.com/a-/AD_cFT-b=s100-p-k-no-mo"
        }
      ]
    }
  ]
}
```

> **Important Attribution Requirement:** If the `authorAttributions` array in
> the photo object is not empty, you **must** display the provided attribution
> (`displayName` and `uri`) in your application wherever the image is shown.

--------------------------------------------------------------------------------

### Step 2: Request the Place Photo

Make an HTTP `GET` request to the Place Photos (New) `media` endpoint using the
`name` obtained in Step 1.

#### Endpoint Pattern

```http
GET https://places.googleapis.com/v1/{NAME}/media
```

#### Parameters

| Parameter          | Type    | Required        | Description                                    |
| :----------------- | :------ | :-------------- | :--------------------------------------------- |
| `NAME`             | Path    | **Yes**         | The photo resource name                        |
:                    : String  :                 : (`places/{PLACE_ID}/photos/{PHOTO_RESOURCE}`). :
| `key`              | Query   | **Yes***        | Your Google Maps Platform API key (*can        |
:                    : String  :                 : alternatively be passed via the                :
:                    :         :                 : `X-Goog-Api-Key` HTTP header).                 :
| `maxHeightPx`      | Integer | **Conditional** | Maximum desired height in pixels (`1` to       |
:                    :         :                 : `4800`). You must specify either               :
:                    :         :                 : `maxHeightPx`, `maxWidthPx`, or both.          :
| `maxWidthPx`       | Integer | **Conditional** | Maximum desired width in pixels (`1` to        |
:                    :         :                 : `4800`). You must specify either               :
:                    :         :                 : `maxHeightPx`, `maxWidthPx`, or both.          :
| `skipHttpRedirect` | Boolean | Optional        | Defaults to `false` (follows an HTTP redirect  |
:                    :         :                 : to return raw image bytes). Set to `true` to   :
:                    :         :                 : skip the redirect and receive a JSON payload   :
:                    :         :                 : containing the `photoUri`.                     :

> **Image Scaling Behavior:** If the original image is smaller than the
> specified dimensions, the original image is returned without scaling. If it is
> larger in either dimension, it is scaled to match the smaller of the two
> constraints while maintaining its original aspect ratio.

#### Option A: Return a JSON Object with `photoUri` (Recommended for Backend/API Clients)

Set `skipHttpRedirect=true` to retrieve a JSON response containing the direct
URI to the hosted image.

```bash
curl -X GET \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://places.googleapis.com/v1/places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E/photos/AUacShh3_Dd8yvV2JZMtNjjbbSbFhSv-0VmUN/media?maxHeightPx=400&maxWidthPx=400&skipHttpRedirect=true"
```

**JSON Response:**

```json
{
  "name": "places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E/photos/AUacShh3_Dd8yvV2JZMtNjjbbSbFhSv-0VmUN/media",
  "photoUri": "https://lh3.googleusercontent.com/places/ANXAkqG..."
}
```

#### Option B: Fetch the Image Binary Directly

Leave `skipHttpRedirect=false` (default) and use `-L` in `curl` (to follow
redirects) if downloading the image binary directly.

```bash
curl -L -X GET \
  -H "X-Goog-Api-Key: YOUR_API_KEY" \
  -H "X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1" \
  "https://places.googleapis.com/v1/places/ChIJ2fzCmcW7j4AR2JzfXBBoh6E/photos/AUacShh3_Dd8yvV2JZMtNjjbbSbFhSv-0VmUN/media?maxHeightPx=400&maxWidthPx=400" \
  --output place_photo.jpg
```

--------------------------------------------------------------------------------

## Restrictions & Error Handling

### Caching Restrictions

-   **Do not cache the photo `name`:** Per Section 3.2.3(b) of the Google Maps
    Platform Terms of Service, you cannot cache the photo resource name, and the
    token can expire at any time. Always obtain a fresh `name` from a Place
    Details, Nearby Search, or Text Search response.

### Common HTTP Error Codes

| Status Code                     | Cause & Resolution                         |
| :------------------------------ | :----------------------------------------- |
| **400 / 404 (Invalid Request)** | <ul><li>Neither `maxHeightPx` nor          |
:                                 : `maxWidthPx` was provided, or a value was  :
:                                 : set to `null` or outside                   :
:                                 : `1..4800`.</li><li>The photo `name` was    :
:                                 : malformed.</li><li>The photo `name` has    :
:                                 : expired. Re-fetch the `photos[]` array     :
:                                 : from Place Details or Search.</li></ul>    :
| **403 (Quota Exceeded)**        | Your API key has exceeded its available    |
:                                 : quota or billing is not enabled. Returns   :
:                                 : an HTTP 403 status alongside a static      :
:                                 : quota-exceeded image.                      :
| **429 (Too Many Requests)**     | Too many photos are being loaded           |
:                                 : concurrently. Load photos on demand (e.g., :
:                                 : lazy loading in UI) rather than fetching   :
:                                 : all photos for all places simultaneously.  :
