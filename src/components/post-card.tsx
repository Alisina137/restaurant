import Link from "next/link";
import { Bike, ImageIcon, MapPin, Store, Utensils } from "lucide-react";
import { FollowButton, PostActions } from "./social-actions";
import { formatMoney } from "@/features/orders/money";

export type FeedPost = {
  id: string;
  caption: string;
  publishedAt: Date;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  city: string;
  area: string;
  cuisine: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  logoId: string | null;
  images: { id: string; position: number }[];
  likeCount: number;
  liked: boolean;
  saved: boolean;
  following: boolean;
  linkedMeal?: {
    id: string;
    name: string;
    priceMinor: number;
    imageKey: string | null;
  } | null;
  freshToday?: {
    id: string;
    specialPriceMinor: number | null;
    stockRemaining: number;
    endsAt: Date;
  } | null;
};

function relativeDate(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function PostCard({
  post,
  signedIn,
  lowData = false,
}: {
  post: FeedPost;
  signedIn: boolean;
  lowData?: boolean;
}) {
  return (
    <article className="feed-card">
      <header className="post-header">
        <Link
          className="post-identity"
          href={`/restaurants/${post.restaurantSlug}`}
        >
          <span className="restaurant-avatar">
            {post.logoId ? (
              <img src={`/api/media/${post.logoId}`} alt="" />
            ) : (
              <Store size={20} />
            )}
          </span>
          <span>
            <strong>{post.restaurantName}</strong>
            <small>
              <MapPin size={13} /> {post.area}, {post.city} ·{" "}
              {relativeDate(post.publishedAt)}
            </small>
          </span>
        </Link>
        <FollowButton
          restaurantId={post.restaurantId}
          initial={post.following}
          signedIn={signedIn}
          compact
        />
      </header>
      <p className="post-caption preserve">{post.caption}</p>
      {post.images.length && !lowData ? (
        <div
          className={`post-media media-count-${Math.min(post.images.length, 4)}`}
        >
          {post.images.map((image, index) => (
            <img
              key={image.id}
              src={`/api/post-media/${image.id}`}
              alt={`${post.restaurantName} post photo ${index + 1}`}
              loading="lazy"
            />
          ))}
        </div>
      ) : (
        <div className="post-placeholder">
          <span>
            <Utensils size={34} />
          </span>
          <div>
            <p>{post.cuisine} kitchen update</p>
            <small>
              <ImageIcon size={14} /> Text post from {post.restaurantName}
            </small>
          </div>
        </div>
      )}
      <div className="post-meta-row">
        <span className="cuisine-pill">{post.cuisine}</span>
        {post.deliveryAvailable && (
          <span>
            <Bike size={15} /> Delivery available
          </span>
        )}
        {post.pickupAvailable && (
          <span>
            <Store size={15} /> Pickup available
          </span>
        )}
      </div>
      {post.linkedMeal && (
        <Link
          className="linked-meal-card"
          href={`/restaurants/${post.restaurantSlug}#menu`}
        >
          <span className="linked-meal-image">
            {post.linkedMeal.imageKey ? (
              <img src={`/api/meal-media/${post.linkedMeal.id}`} alt="" />
            ) : (
              <Utensils size={20} />
            )}
          </span>
          <span>
            <small>
              {post.freshToday ? "FRESH TODAY" : "ORDER FROM THIS POST"}
            </small>
            <strong>{post.linkedMeal.name}</strong>
            {post.freshToday && (
              <em>
                {post.freshToday.stockRemaining} left · ends{" "}
                {new Intl.DateTimeFormat("en-AF", {
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(post.freshToday.endsAt))}
              </em>
            )}
          </span>
          <b>
            {formatMoney(
              post.freshToday?.specialPriceMinor ?? post.linkedMeal.priceMinor,
            )}
          </b>
        </Link>
      )}
      <PostActions
        postId={post.id}
        initialLiked={post.liked}
        initialSaved={post.saved}
        initialLikeCount={post.likeCount}
        signedIn={signedIn}
      />
    </article>
  );
}
