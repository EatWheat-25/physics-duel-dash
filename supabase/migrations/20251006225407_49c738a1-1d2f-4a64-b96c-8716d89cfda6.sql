-- Assign admin role to user "Him"
INSERT INTO public.user_roles (user_id, role)
VALUES ('934903e5-2d36-44f4-a63e-c5a1d0e1247b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;