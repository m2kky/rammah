DO $$
DECLARE
  about_page_id uuid;
  recognition_section_id uuid;
  portrait_asset_id uuid;
BEGIN
  SELECT id INTO about_page_id
  FROM pages
  WHERE slug = 'about' AND status = 'published'
  LIMIT 1;

  IF about_page_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO recognition_section_id
  FROM page_sections
  WHERE page_id = about_page_id
    AND section_type = 'recognition'
    AND status <> 'archived'
  ORDER BY sort_order, id
  LIMIT 1;

  IF recognition_section_id IS NULL THEN
    INSERT INTO page_sections (
      page_id,
      section_type,
      title,
      body,
      config,
      sort_order,
      status
    ) VALUES (
      about_page_id,
      'recognition',
      '(04) Official recognition',
      'Officially listed among aCRL® Cooperation & Project Partners — Middle East.',
      jsonb_build_object(
        'name', 'Ahmed Sherif Rammah',
        'roles', 'Supervisor aCRL® Middle East · Master Trainer aCRL®',
        'sourceLabel', 'acrl-academy.eu',
        'profileBadge', 'Official profile',
        'cta', jsonb_build_object(
          'label', 'View Ahmed on aCRL® Academy',
          'url', 'https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah'
        )
      ),
      60,
      'published'
    )
    RETURNING id INTO recognition_section_id;
  END IF;

  UPDATE page_sections
  SET
    title = CASE
      WHEN title IS NULL OR title = '(04) The reach' THEN '(05) The reach'
      ELSE title
    END,
    sort_order = 70,
    updated_at = now()
  WHERE page_id = about_page_id
    AND section_type = 'reach'
    AND status <> 'archived';

  UPDATE page_sections
  SET
    title = CASE
      WHEN title IS NULL OR title = '(05) Start the work' THEN '(06) Start the work'
      ELSE title
    END,
    sort_order = 80,
    updated_at = now()
  WHERE page_id = about_page_id
    AND section_type = 'cta'
    AND status <> 'archived';

  SELECT id INTO portrait_asset_id
  FROM media_assets
  WHERE source_type = 'external'
    AND public_url = '/acrl-ahmed-rammah.webp'
  ORDER BY id
  LIMIT 1;

  IF portrait_asset_id IS NULL THEN
    INSERT INTO media_assets (
      display_name,
      file_name,
      mime_type,
      source_type,
      media_kind,
      public_url,
      alt_text,
      size_bytes,
      width,
      height,
      metadata,
      processing_state,
      status
    ) VALUES (
      'Ahmed Rammah — official aCRL profile',
      'acrl-ahmed-rammah.webp',
      'image/webp',
      'external',
      'image',
      '/acrl-ahmed-rammah.webp',
      'Ahmed Sherif Rammah on the official aCRL Academy website',
      0,
      300,
      300,
      jsonb_build_object(
        'sourceUrl', 'https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png',
        'officialPage', 'https://acrl-academy.eu/acrl-academy-eddi-schulze-2/'
      ),
      'ready',
      'published'
    )
    RETURNING id INTO portrait_asset_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM section_media_assignments
    WHERE page_section_id = recognition_section_id
      AND slot_key = 'portrait'
  ) THEN
    INSERT INTO section_media_assignments (
      page_section_id,
      slot_key,
      media_asset_id,
      sort_order,
      decorative
    ) VALUES (
      recognition_section_id,
      'portrait',
      portrait_asset_id,
      0,
      false
    );
  END IF;
END $$;
