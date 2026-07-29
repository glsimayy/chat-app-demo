import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

// interface
import { MediaTypes, MediaListItemTypes } from "../data/myProfile";

interface MediaProps {
  media: MediaTypes;
  limit: number;
}

interface MediaItemProps {
  mediaItem: MediaListItemTypes;
  hasMore: boolean;
  remainingItem: number;
}
const MediaItem = ({ mediaItem, hasMore, remainingItem }: MediaItemProps) => {
  const { t } = useTranslation();

  return (
    <div className="media-img-list">
      <Link to="#">
        <img
          src={mediaItem.url}
          alt={t("profile.media")}
          className="img-fluid"
        />
        {hasMore && <div className="bg-overlay">+ {remainingItem}</div>}
      </Link>
    </div>
  );
};
const Media = ({ media, limit }: MediaProps) => {
  const { t } = useTranslation();
  const [mediaList, setMediaList] = useState<MediaListItemTypes[]>([]);
  useEffect(() => {
    if (media && media.list) setMediaList(media.list);
  }, [media]);
  const total = mediaList.length;
  const remainingItem = total - limit;
  return (
    <div>
      <div className="d-flex">
        <div className="flex-grow-1">
          <h5 className="font-size-11 text-muted text-uppercase">
            {t("profile.media")}
          </h5>
        </div>
        <div className="flex-shrink-0">
          <Link to="#" className="font-size-12 d-block mb-2">
            {t("profile.showAll")}
          </Link>
        </div>
      </div>
      <div className="profile-media-img">
        {media
          ? (mediaList || []).map(
              (mediaItem: MediaListItemTypes, key: number) => {
                const hasMore: boolean = key === limit;

                if (key <= limit) {
                  return (
                    <MediaItem
                      mediaItem={mediaItem}
                      key={key}
                      hasMore={hasMore}
                      remainingItem={remainingItem}
                    />
                  );
                } else return null;
              },
            )
          : t("profile.noMedia")}
      </div>
    </div>
  );
};
export default Media;
