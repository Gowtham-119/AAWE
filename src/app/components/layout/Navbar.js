import { useAuth } from '../../context/AuthContext';
import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	AppBar,
	Avatar,
	Badge,
	Box,
	Chip,
	Divider,
	IconButton,
	InputBase,
	List,
	ListItem,
	ListItemText,
	Popover,
	Toolbar,
	Typography,
	Tooltip,
} from '@mui/material';
import { Bell, Menu, Search, Moon, Sun } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { getNotifications, markAllNotificationsRead } from '../../lib/academicDataApi';
import { LIVE_STALE_TIME_MS } from '../../lib/queryClient';
import { queryKeys } from '../../lib/queryKeys';
import { useThemeMode } from '../../context/ThemeModeContext.js';

const TYPE_DOT_COLORS = {
	info: '#2563eb',
	warning: '#d97706',
	success: '#16a34a',
	error: '#dc2626',
};

const Navbar = ({ onToggleSidebar, user }) => {
	const { institutionName } = useAuth();
	const { themeMode, toggleThemeMode } = useThemeMode();
	const isStudent = user?.role === 'student';
	const initials = (user?.name || 'User')
		.split(' ')
		.map((part) => part[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();

	const [notifications, setNotifications] = useState([]);
	const [bellAnchor, setBellAnchor] = useState(null);
	const channelRef = useRef(null);
	const queryClient = useQueryClient();
	const normalizedEmail = (user?.email || '').trim().toLowerCase();

	const unreadCount = notifications.filter((n) => !n.is_read).length;

	const { data: notificationRows = [] } = useQuery({
		queryKey: queryKeys.common.notifications(normalizedEmail),
		queryFn: () => getNotifications(normalizedEmail),
		enabled: Boolean(normalizedEmail),
		staleTime: LIVE_STALE_TIME_MS,
	});

	const markAllReadMutation = useMutation({
		mutationFn: (email) => markAllNotificationsRead(email),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: queryKeys.common.notifications(normalizedEmail) });
		},
	});

	useEffect(() => {
		setNotifications(notificationRows);
	}, [notificationRows]);

	useEffect(() => {
		if (!normalizedEmail) return;
		const email = normalizedEmail;
		const channel = supabase
			.channel(`notifications:${email}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `recipient_email=eq.${email}`,
				},
				() => {
					void queryClient.invalidateQueries({ queryKey: queryKeys.common.notifications(email) });
				},
			)
			.subscribe();
		channelRef.current = channel;
		return () => {
			supabase.removeChannel(channel);
		};
	}, [normalizedEmail, queryClient]);

	const handleBellClick = async (event) => {
		setBellAnchor(event.currentTarget);
		if (unreadCount > 0 && normalizedEmail) {
			try {
				await markAllReadMutation.mutateAsync(normalizedEmail);
				setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
			} catch {
				// non-critical
			}
		}
	};

	const handleBellClose = () => setBellAnchor(null);
	const bellOpen = Boolean(bellAnchor);

	const bellButton = (
		<>
			<Tooltip title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
				<IconButton onClick={toggleThemeMode} size="small" sx={{ color: '#6b7280' }}>
					{themeMode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
				</IconButton>
			</Tooltip>
			<IconButton onClick={handleBellClick} size="small" sx={{ color: '#6b7280' }}>
				<Badge badgeContent={unreadCount || null} color="error" max={99}>
					<Bell size={20} />
				</Badge>
			</IconButton>
			<Popover
				open={bellOpen}
				anchorEl={bellAnchor}
				onClose={handleBellClose}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				transformOrigin={{ vertical: 'top', horizontal: 'right' }}
				PaperProps={{
					sx: {
						width: 340,
						maxHeight: 420,
						overflow: 'hidden',
						display: 'flex',
						flexDirection: 'column',
						borderRadius: 2,
						boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
					},
				}}
			>
				<Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(148,163,184,0.24)', flexShrink: 0 }}>
					<Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
						Notifications
						{unreadCount > 0 && (
							<Box
								component="span"
								sx={{
									ml: 1,
									px: 0.75,
									py: 0.25,
									borderRadius: 1,
									bgcolor: '#dc2626',
									color: '#fff',
									fontSize: '0.7rem',
									fontWeight: 700,
									verticalAlign: 'middle',
								}}
							>
								{unreadCount}
							</Box>
						)}
					</Typography>
				</Box>

				{notifications.length === 0 ? (
					<Box sx={{ p: 3, textAlign: 'center' }}>
						<Typography sx={{ fontSize: '0.875rem', color: '#9ca3af' }}>No notifications yet</Typography>
					</Box>
				) : (
					<List dense disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
						{notifications.map((n, idx) => (
							<React.Fragment key={n.id}>
								{idx > 0 && <Divider />}
								<ListItem
									alignItems="flex-start"
									sx={{
										px: 2,
										py: 1.25,
										backgroundColor: n.is_read ? 'transparent' : 'rgba(37,99,235,0.04)',
										gap: 1,
									}}
								>
									<Box
										sx={{
											width: 7,
											minWidth: 7,
											height: 7,
											borderRadius: '50%',
											bgcolor: TYPE_DOT_COLORS[n.type] || '#2563eb',
											mt: 0.75,
											flexShrink: 0,
										}}
									/>
									<ListItemText
										disableTypography
										primary={
											<Typography
												sx={{
													fontWeight: n.is_read ? 400 : 600,
													fontSize: '0.8125rem',
													color: '#111827',
													lineHeight: 1.4,
												}}
											>
												{n.title}
											</Typography>
										}
										secondary={
											<Box>
												{n.body && (
													<Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mt: 0.4, lineHeight: 1.4 }}>
														{n.body}
													</Typography>
												)}
												<Typography sx={{ fontSize: '0.7rem', color: '#9ca3af', mt: 0.5 }}>
													{new Date(n.created_at).toLocaleString()}
												</Typography>
											</Box>
										}
									/>
								</ListItem>
							</React.Fragment>
						))}
					</List>
				)}
			</Popover>
		</>
	);

	return (
		<AppBar
			position="static"
			elevation={0}
			sx={{
				backgroundColor: 'rgba(255,255,255,0.62)',
				color: '#111827',
				borderBottom: '1px solid rgba(148,163,184,0.24)',
				backdropFilter: 'blur(16px)',
			}}
		>
			<Toolbar sx={{ minHeight: 64, px: isStudent ? 0 : 2 }}>
				<IconButton
					onClick={onToggleSidebar}
					edge="start"
					sx={{
						display: isStudent ? { xs: 'inline-flex', lg: 'none' } : { xs: 'inline-flex', lg: 'none' },
						mr: isStudent ? 0 : 1,
						borderRight: isStudent ? '1px solid rgba(148,163,184,0.24)' : 'none',
						borderRadius: 0,
						width: isStudent ? 84 : 'auto',
						height: isStudent ? 64 : 'auto',
					}}
				>
					<Menu size={20} />
				</IconButton>

				{isStudent ? (
					<>
						<Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 2.5 }}>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1,
									width: '100%',
									maxWidth: 480,
									height: 44,
									px: 1.5,
									borderRadius: 2,
									backgroundColor: 'rgba(248,250,252,0.78)',
									border: '1px solid rgba(148,163,184,0.24)',
									backdropFilter: 'blur(10px)',
								}}
							>
								<Search size={18} color="#6b7280" />
								<InputBase placeholder="Search..." sx={{ width: '100%', fontSize: '1rem', color: '#111827' }} />
							</Box>
						</Box>

						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								borderLeft: '1px solid rgba(148,163,184,0.24)',
								pl: 2,
								pr: 2.5,
								height: 64,
								gap: 2,
							}}
						>
							{bellButton}
							<Box sx={{ borderLeft: '1px solid rgba(148,163,184,0.24)', height: 36 }} />
							<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
								<Box sx={{ textAlign: 'right' }}>
									<Typography sx={{ fontWeight: 600, fontSize: '1rem', color: '#111827', lineHeight: 1 }}>
										{user?.name || 'Student User'}
									</Typography>
									<Chip
										label="Student"
										size="small"
										sx={{ mt: 0.5, backgroundColor: 'rgba(37,99,235,0.9)', color: '#fff', height: 22, fontWeight: 500 }}
									/>
								</Box>
								<Avatar
									sx={{
										width: 48,
										height: 48,
										bgcolor: '#2563eb',
										fontWeight: 600,
										boxShadow: '0 12px 24px rgba(37,99,235,0.28)',
									}}
								>
									{initials}
								</Avatar>
							</Box>
						</Box>
					</>
				) : (
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
						<Typography sx={{ fontWeight: 600, fontSize: '1rem' }}>{institutionName || 'Academic Dashboard'}</Typography>
						{bellButton}
					</Box>
				)}
			</Toolbar>
		</AppBar>
	);
};

export default Navbar;

