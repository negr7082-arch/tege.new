package org.tege.messenger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import kotlinx.coroutines.launch
import org.tege.messenger.model.ScreenRoute
import org.tege.messenger.model.Story
import org.tege.messenger.ui.components.CreateStoryDialog
import org.tege.messenger.ui.components.StoryViewerDialog
import org.tege.messenger.ui.components.TelegramDrawer
import org.tege.messenger.ui.screens.*
import org.tege.messenger.ui.theme.TegeTheme
import org.tege.messenger.viewmodel.TegeViewModel

class MainActivity : ComponentActivity() {
    private val viewModel: TegeViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val settings by viewModel.settings.collectAsState()
            val currentAccount by viewModel.currentAccount.collectAsState()
            val currentRoute by viewModel.currentRoute.collectAsState()

            var showCreateStoryDialog by remember { mutableStateOf(false) }
            var viewingStory by remember { mutableStateOf<Story?>(null) }

            val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
            val scope = rememberCoroutineScope()

            TegeTheme(darkTheme = settings.isDarkMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (currentAccount == null) {
                        AuthScreen(
                            viewModel = viewModel,
                            onSuccess = { viewModel.navigateTo(ScreenRoute.ChatList) }
                        )
                    } else {
                        ModalNavigationDrawer(
                            drawerState = drawerState,
                            drawerContent = {
                                TelegramDrawer(
                                    viewModel = viewModel,
                                    currentAccount = currentAccount,
                                    onCloseDrawer = { scope.launch { drawerState.close() } }
                                )
                            }
                        ) {
                            // Back handling for navigation stack
                            if (currentRoute !is ScreenRoute.ChatList) {
                                BackHandler {
                                    viewModel.navigateBack()
                                }
                            }

                            when (val route = currentRoute) {
                                is ScreenRoute.ChatList -> {
                                    ChatListScreen(
                                        viewModel = viewModel,
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onOpenCreateStory = { showCreateStoryDialog = true },
                                        onViewStory = { story -> viewingStory = story }
                                    )
                                }
                                is ScreenRoute.ChatDetail -> {
                                    ChatDetailScreen(
                                        chatId = route.chatId,
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                is ScreenRoute.Profile -> {
                                    ProfileScreen(
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                is ScreenRoute.Channels -> {
                                    ChannelsScreen(
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                is ScreenRoute.Settings -> {
                                    SettingsScreen(
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                is ScreenRoute.Calls -> {
                                    CallsScreen(
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                is ScreenRoute.Contacts -> {
                                    ContactsScreen(
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                is ScreenRoute.CreateChat -> {
                                    CreateChatScreen(
                                        viewModel = viewModel,
                                        onBack = { viewModel.navigateBack() }
                                    )
                                }
                                else -> {
                                    ChatListScreen(
                                        viewModel = viewModel,
                                        onOpenDrawer = { scope.launch { drawerState.open() } },
                                        onOpenCreateStory = { showCreateStoryDialog = true },
                                        onViewStory = { story -> viewingStory = story }
                                    )
                                }
                            }
                        }
                    }

                    // Dialogs
                    if (showCreateStoryDialog) {
                        CreateStoryDialog(
                            onDismiss = { showCreateStoryDialog = false },
                            onCreate = { text, color ->
                                viewModel.createStory(text, color)
                            }
                        )
                    }

                    viewingStory?.let { story ->
                        StoryViewerDialog(
                            story = story,
                            onDismiss = { viewingStory = null }
                        )
                    }
                }
            }
        }
    }
}
