import {
  IsBoolean,
  ValidateIf,
  IsIn,
  IsString,
  MaxLength,
  IsOptional,
  Equals,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

// TikTok's Content Sharing Guidelines only apply to a DIRECT_POST, an UPLOAD
// just lands in the user's TikTok inbox where they finish the post themselves.
const isDirectPost = (post: { content_posting_method?: string }) =>
  post.content_posting_method !== 'UPLOAD';

// Content disclosure: when the toggle is on, the creator must say whether the
// content promotes themselves ("Your brand"), a third party ("Branded
// content"), or both. Publishing stays blocked until one is selected.
@ValidatorConstraint({ name: 'IsTikTokDisclosureComplete', async: false })
export class IsTikTokDisclosureCompleteConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const post = args.object as TikTokDto;
    if (!isDirectPost(post) || !post.disclose) {
      return true;
    }
    return !!post.brand_organic_toggle || !!post.brand_content_toggle;
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'You need to indicate if your content promotes yourself, a third party, or both.';
  }
}

export function IsTikTokDisclosureComplete(
  validationOptions?: ValidationOptions
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsTikTokDisclosureCompleteConstraint,
    });
  };
}

// Branded content ("Paid partnership") cannot be private on TikTok.
@ValidatorConstraint({ name: 'IsTikTokPrivacyAllowed', async: false })
export class IsTikTokPrivacyAllowedConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    const post = args.object as TikTokDto;
    if (!isDirectPost(post)) {
      return true;
    }
    return !(post.brand_content_toggle && value === 'SELF_ONLY');
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'Branded content visibility cannot be set to private.';
  }
}

export function IsTikTokPrivacyAllowed(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsTikTokPrivacyAllowedConstraint,
    });
  };
}

// TikTok only honors most of these settings on a DIRECT_POST. With
// content_posting_method=UPLOAD the media lands in the user's TikTok inbox as a
// draft, and TikTok's inbox/upload endpoints accept nothing but the title /
// description - every other field below is silently discarded.
// video_made_with_ai / duet / stitch are additionally video-only: TikTok's photo
// post_info has no is_aigc, disable_duet or disable_stitch field.
// Fields stay required here (existing clients depend on it); the constraints are
// documented, not enforced.
export class TikTokDto {
  @ValidateIf((p) => p.title)
  @MaxLength(90)
  @JSONSchema({
    description:
      'Used as the title of the post. The only setting TikTok keeps when content_posting_method=UPLOAD.',
  })
  title: string;

  @ValidateIf(isDirectPost)
  @IsIn([
    'PUBLIC_TO_EVERYONE',
    'MUTUAL_FOLLOW_FRIENDS',
    'FOLLOWER_OF_CREATOR',
    'SELF_ONLY',
  ])
  @IsString()
  @IsTikTokPrivacyAllowed()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  privacy_level:
    | 'PUBLIC_TO_EVERYONE'
    | 'MUTUAL_FOLLOW_FRIENDS'
    | 'FOLLOWER_OF_CREATOR'
    | 'SELF_ONLY';

  @IsBoolean()
  @JSONSchema({
    description:
      'Video posts only, and only when content_posting_method=DIRECT_POST. TikTok has no duet setting for photo posts.',
  })
  duet: boolean;

  @IsBoolean()
  @JSONSchema({
    description:
      'Video posts only, and only when content_posting_method=DIRECT_POST. TikTok has no stitch setting for photo posts.',
  })
  stitch: boolean;

  @IsBoolean()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  comment: boolean;

  @IsIn(['yes', 'no'])
  @JSONSchema({
    description:
      'Photo posts only, and only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  autoAddMusic: 'yes' | 'no';

  @IsBoolean()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  brand_content_toggle: boolean;

  @IsBoolean()
  @IsOptional()
  @JSONSchema({
    description:
      'Labels the post as AI generated. Video posts only, and only when content_posting_method=DIRECT_POST. TikTok has no AI-generated label for photo posts, and discards it on UPLOAD.',
  })
  video_made_with_ai: boolean;

  @IsBoolean()
  @JSONSchema({
    description:
      'Applied only when content_posting_method=DIRECT_POST. Ignored by TikTok on UPLOAD.',
  })
  brand_organic_toggle: boolean;

  @IsIn(['DIRECT_POST', 'UPLOAD'])
  @IsString()
  @JSONSchema({
    description:
      'Required. Use "DIRECT_POST" to actually publish the post to TikTok. ' +
      '"UPLOAD" does NOT publish: it only sends the media to the user\'s TikTok app inbox, ' +
      'where they must manually finish and publish it within 24 hours or it is discarded, ' +
      'and it makes TikTok ignore every other setting here. ' +
      'Only use "UPLOAD" when the user explicitly asks to review or edit the post inside the TikTok app before publishing.',
  })
  content_posting_method: 'DIRECT_POST' | 'UPLOAD';

  @IsBoolean()
  @IsOptional()
  @IsTikTokDisclosureComplete()
  @JSONSchema({
    description:
      'Content disclosure toggle. When true, brand_organic_toggle and/or brand_content_toggle must be true. Applied only when content_posting_method=DIRECT_POST.',
  })
  disclose?: boolean;

  @ValidateIf((p) => p.creator_can_post === false)
  @Equals(true, {
    message:
      'TikTok reports that this account cannot post right now. Please try again later.',
  })
  @JSONSchema({
    description:
      'Set by the Postiz UI from the TikTok creator info. Do not send it through the API.',
  })
  creator_can_post?: boolean;

  @ValidateIf((p) => p.video_within_limit === false)
  @Equals(true, {
    message:
      'This video is longer than the maximum duration TikTok allows for this account.',
  })
  @JSONSchema({
    description:
      'Set by the Postiz UI from the TikTok creator info. Do not send it through the API.',
  })
  video_within_limit?: boolean;
}
