-- Sample data so the site is not empty. PRICES ARE PLACEHOLDERS: edit them in the admin panel.

INSERT INTO vehicles (name, vehicle_type, seats, ac, description, rate_per_km, rate_per_day, min_km, driver_allowance, night_charge) VALUES
 ('Tempo Traveller (12 seater)', 'traveller', 12, TRUE,  'Pushback seats, music system, luggage space. Ideal for groups and families.', 28, 3500, 250, 500, 500),
 ('Toyota Tavera (9 seater)',    'tavera',     9, TRUE,  'Comfortable for hill roads. Good for families up to 8.',                       18, 2500, 250, 400, 400),
 ('Auto Rickshaw',               'auto',       3, FALSE, 'Local sightseeing around Kalpetta, Sulthan Bathery and Mananthavady.',         14,  900, 80,  200, 0);

INSERT INTO packages (slug, title, category, summary, duration_days, price_per_person, vehicle_id, hotel_name, includes)
SELECT '2-days-wayanad', '2 Days Wayanad Escape', 'Family',
       'Waterfalls, lakes and viewpoints in a relaxed two-day trip.', 2, 4500, v.id, 'Partner resort, Vythiri',
       ARRAY['AC vehicle with driver','1 night stay','Breakfast','Toll and parking']
FROM vehicles v WHERE v.vehicle_type = 'tavera';

INSERT INTO packages (slug, title, category, summary, duration_days, price_per_person, vehicle_id, hotel_name, includes)
SELECT 'wayanad-honeymoon', 'Wayanad Honeymoon', 'Honeymoon',
       'Three romantic days among tea estates, misty peaks and private stays.', 3, 8500, v.id, 'Partner resort, Vythiri',
       ARRAY['AC vehicle with driver','2 nights stay','Breakfast and dinner','Candle-light dinner']
FROM vehicles v WHERE v.vehicle_type = 'tavera';

INSERT INTO packages (slug, title, category, summary, duration_days, price_per_person, vehicle_id, hotel_name, includes)
SELECT 'wayanad-adventure', 'Wayanad Adventure', 'Adventure',
       'Chembra Peak trek, Edakkal caves and Kuruva Island rafting.', 3, 6500, v.id, 'Homestay, Kalpetta',
       ARRAY['AC vehicle with driver','2 nights stay','Breakfast','Trek guide']
FROM vehicles v WHERE v.vehicle_type = 'traveller';

INSERT INTO package_items (package_id, day_number, title, description, places)
SELECT p.id, d.n, d.t, d.descr, d.pl FROM packages p
JOIN (VALUES
 ('2-days-wayanad', 1, 'Lakes and Falls', 'Pickup, check-in and an afternoon at the lake.', 'Pookode Lake, Lakkidi, Chain Tree'),
 ('2-days-wayanad', 2, 'Caves and Dam',   'Heritage morning then a dam sunset before drop.', 'Edakkal Caves, Banasura Sagar Dam'),
 ('wayanad-honeymoon', 1, 'Arrival',      'Check in, rest and enjoy a tea-estate walk.', 'Lakkidi, Chain Tree'),
 ('wayanad-honeymoon', 2, 'Hills and Falls', 'Full day of viewpoints and waterfalls.', 'Soochipara Falls, Banasura Hills'),
 ('wayanad-honeymoon', 3, 'Heritage',     'Quiet morning sightseeing and departure.', 'Edakkal Caves, Thirunelli Temple'),
 ('wayanad-adventure', 1, 'Chembra Peak', 'Guided trek to the heart-shaped lake.', 'Chembra Peak'),
 ('wayanad-adventure', 2, 'Wildlife',     'Kuruva Island and Muthanga safari.', 'Kuruva Island, Muthanga'),
 ('wayanad-adventure', 3, 'Caves',        'Edakkal climb and return.', 'Edakkal Caves')
) AS d(slug, n, t, descr, pl) ON d.slug = p.slug;
